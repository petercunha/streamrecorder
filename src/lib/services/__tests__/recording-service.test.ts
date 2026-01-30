import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { EventEmitter } from 'events';
import { clearTestDb, getTestDb } from '../../../../tests/db-mock';
import { RecordingService } from '../recording-service';
import { StreamerModel } from '@/lib/models/streamer';
import { RecordingModel } from '@/lib/models/recording';
import { RecordingLogModel } from '@/lib/models/recording-log';
import { StatsModel } from '@/lib/models/stats';
import * as diskSpace from '@/lib/utils/disk-space';

// Mock disk-space module
vi.mock('@/lib/utils/disk-space', () => ({
  checkDiskSpaceForRecording: vi.fn(() => ({ allowed: true, freeSpaceMb: 10000, usedPercentage: 50 })),
  getDiskSpaceStatus: vi.fn(() => ({ total: '100 GB', used: '50 GB', free: '50 GB', usedPercentage: 50, status: 'ok' as const })),
  getTotalRecordingsSizeMb: vi.fn(() => 0),
  formatBytes: vi.fn((bytes: number) => `${bytes} B`),
  getMaxRecordingSizeMb: vi.fn(() => 0),
  getMaxRecordingDurationMs: vi.fn(() => 0),
}));

// Mock child_process
let mockSpawnImplementation: ReturnType<typeof vi.fn>;

vi.mock('child_process', () => ({
  spawn: vi.fn((...args: unknown[]) => mockSpawnImplementation(...args)),
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    statSync: vi.fn(() => ({ size: 1024 * 1024 })),
    statfsSync: vi.fn(() => ({
      bsize: 4096,
      blocks: 10000000,
      bavail: 8000000,
      bfree: 8500000,
    })),
    readdirSync: vi.fn(() => []),
  },
}));

// Track active mock processes for cleanup
const activeMockProcesses: Set<ReturnType<typeof createMockProcess>> = new Set();

// Helper to create mock child process
function createMockProcess(options: {
  isLive?: boolean;
  title?: string;
  category?: string;
  error?: string;
  exitCode?: number | null;
  delayMs?: number;
  longRunning?: boolean;
} = {}) {
  const {
    isLive = true,
    title = 'Test Stream',
    category = 'Just Chatting',
    error,
    exitCode = 0,
    delayMs = 10,
    longRunning = false,
  } = options;

  const mockProcess = new EventEmitter() as EventEmitter & {
    killed: boolean;
    kill: (signal?: string) => boolean;
    stdout: EventEmitter;
    stderr: EventEmitter;
    _forceClose: () => void;
  };

  mockProcess.killed = false;
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();

  // Keep track of timers to clean them up
  const timers: NodeJS.Timeout[] = [];

  mockProcess.kill = vi.fn((signal?: string) => {
    if (mockProcess.killed) return true;
    mockProcess.killed = true;
    
    const killDelay = signal === 'SIGKILL' ? 10 : delayMs;
    const timer = setTimeout(() => {
      mockProcess.emit('close', signal === 'SIGKILL' ? 1 : exitCode);
    }, killDelay);
    timers.push(timer);
    
    return true;
  });

  // Method to force close the process (for test cleanup)
  mockProcess._forceClose = () => {
    timers.forEach(t => clearTimeout(t));
    if (!mockProcess.killed) {
      mockProcess.killed = true;
      mockProcess.emit('close', exitCode);
    }
  };

  // Simulate streamlink output
  const outputTimer = setTimeout(() => {
    if (mockProcess.killed) return;

    let output: string;
    
    if (error) {
      output = JSON.stringify({ error });
    } else if (isLive) {
      output = JSON.stringify({
        metadata: { title, category },
        type: 'hls',
        url: 'https://test-stream.example/stream.m3u8',
      });
    } else {
      output = JSON.stringify({ error: 'No playable streams found' });
    }

    mockProcess.stdout.emit('data', Buffer.from(output));
    
    // For recording processes (longRunning), don't auto-close
    // For metadata checks, close after emitting output
    if (!longRunning) {
      const closeTimer = setTimeout(() => {
        if (!mockProcess.killed) {
          mockProcess.emit('close', exitCode);
        }
      }, delayMs);
      timers.push(closeTimer);
    }
  }, delayMs);
  timers.push(outputTimer);

  activeMockProcesses.add(mockProcess);
  
  // Clean up function for this process
  const originalEmit = mockProcess.emit.bind(mockProcess);
  mockProcess.emit = function(event: string | symbol, ...args: unknown[]) {
    if (event === 'close') {
      activeMockProcesses.delete(mockProcess);
      timers.forEach(t => clearTimeout(t));
    }
    return originalEmit(event, ...args);
  };

  return mockProcess;
}

describe('RecordingService', () => {
  let service: RecordingService;

  beforeAll(() => {
    // Initialize database
    getTestDb();
  });

  beforeEach(() => {
    clearTestDb();

    // Create fresh service instance
    service = new RecordingService();

    // Default mock implementation for metadata checks
    mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
      // Check if this is a metadata check (--json flag) or recording (no --json, has -o)
      const isMetadataCheck = args.includes('--json');
      return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
    });
  });

  afterEach(async () => {
    // Force close all mock processes
    activeMockProcesses.forEach(p => p._forceClose());
    activeMockProcesses.clear();
    
    // Properly shutdown service
    await service.shutdown();
    service.reset();
  });

  afterAll(() => {
    const db = getTestDb();
    db.close();
  });

  describe('Lifecycle Management', () => {
    describe('startAutoChecker', () => {
      it('should start the auto checker interval', () => {
        vi.useFakeTimers();
        
        service.startAutoChecker(60000);
        
        // Should be running without errors
        expect(() => vi.advanceTimersByTime(60000)).not.toThrow();
        
        vi.useRealTimers();
      });

      it('should check streamers on interval', async () => {
        vi.useFakeTimers();
        
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
        });
        
        const streamer = StreamerModel.create({ username: 'testuser' });
        service.startAutoChecker(60000);
        
        // First check happens on next tick
        await vi.advanceTimersByTimeAsync(60000);
        
        expect(mockSpawnImplementation).toHaveBeenCalled();
        
        vi.useRealTimers();
      });

      it('should clear existing interval when starting new one', () => {
        vi.useFakeTimers();
        
        service.startAutoChecker(30000);
        service.startAutoChecker(60000);
        
        // Should not throw
        expect(() => vi.advanceTimersByTime(60000)).not.toThrow();
        
        vi.useRealTimers();
      });
    });

    describe('stopAutoChecker', () => {
      it('should stop the auto checker', () => {
        vi.useFakeTimers();
        
        service.startAutoChecker(60000);
        service.stopAutoChecker();
        
        // Advance time - should not trigger any checks
        vi.advanceTimersByTime(120000);
        
        expect(mockSpawnImplementation).not.toHaveBeenCalled();
        
        vi.useRealTimers();
      });

      it('should handle stopping when not started', () => {
        expect(() => service.stopAutoChecker()).not.toThrow();
      });
    });
  });

  describe('Stream Detection', () => {
    describe('checkIfLive', () => {
      it('should return true for live stream', async () => {
        mockSpawnImplementation = vi.fn(() => createMockProcess({ isLive: true }));
        
        const isLive = await service.checkIfLive('testuser');
        
        expect(isLive).toBe(true);
        expect(mockSpawnImplementation).toHaveBeenCalledWith(
          'streamlink',
          ['--json', 'https://twitch.tv/testuser', 'best']
        );
      });

      it('should return false for offline stream', async () => {
        mockSpawnImplementation = vi.fn(() => createMockProcess({ isLive: false }));
        
        const isLive = await service.checkIfLive('testuser');
        
        expect(isLive).toBe(false);
      });

      it('should handle streamlink errors', async () => {
        mockSpawnImplementation = vi.fn(() => createMockProcess({ error: 'Connection failed' }));
        
        const isLive = await service.checkIfLive('testuser');
        
        expect(isLive).toBe(false);
      });

      it('should handle process errors', async () => {
        const mockProcess = createMockProcess({});
        mockSpawnImplementation = vi.fn(() => mockProcess);
        
        // Emit error immediately
        setTimeout(() => {
          mockProcess.emit('error', new Error('Spawn failed'));
        }, 5);
        
        const isLive = await service.checkIfLive('testuser');
        
        expect(isLive).toBe(false);
      });

      it('should timeout after 10 seconds', async () => {
        const mockProcess = createMockProcess({ delayMs: 20000 });
        mockSpawnImplementation = vi.fn(() => mockProcess);
        
        vi.useFakeTimers();
        
        const promise = service.checkIfLive('testuser');
        
        // Advance past timeout
        vi.advanceTimersByTime(10000);
        
        const isLive = await promise;
        
        expect(isLive).toBe(false);
        
        vi.useRealTimers();
      });
    });

    describe('getStreamMetadata', () => {
      it('should return metadata for live stream', async () => {
        mockSpawnImplementation = vi.fn(() => createMockProcess({
          isLive: true,
          title: 'Awesome Stream',
          category: 'Gaming',
        }));
        
        const metadata = await service.getStreamMetadata('testuser');
        
        expect(metadata).toEqual({
          title: 'Awesome Stream',
          category: 'Gaming',
        });
      });

      it('should return null for offline stream', async () => {
        mockSpawnImplementation = vi.fn(() => createMockProcess({ isLive: false }));
        
        const metadata = await service.getStreamMetadata('testuser');
        
        expect(metadata).toBeNull();
      });

      it('should handle errors', async () => {
        mockSpawnImplementation = vi.fn(() => createMockProcess({ error: 'Failed' }));
        
        const metadata = await service.getStreamMetadata('testuser');
        
        expect(metadata).toBeNull();
      });
    });
  });

  describe('Recording Control', () => {
    describe('startRecording', () => {
      it('should throw error if streamer not found', async () => {
        await expect(service.startRecording(999999)).rejects.toThrow('Streamer not found');
      });

      it('should throw error if already recording', async () => {
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
        });
        
        const streamer = StreamerModel.create({ username: 'testuser' });
        
        // Start first recording (this will take a bit due to metadata check)
        await service.startRecording(streamer.id);
        
        // Try to start again - should throw immediately
        await expect(service.startRecording(streamer.id)).rejects.toThrow('Already recording this streamer');
      });

      it('should create recording record and spawn process', async () => {
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ 
            isLive: true, 
            title: 'Test Stream',
            category: 'Just Chatting',
            delayMs: 10, 
            longRunning: !isMetadataCheck 
          });
        });
        
        const streamer = StreamerModel.create({ username: 'testuser' });
        
        const recordingId = await service.startRecording(streamer.id);
        
        expect(recordingId).toBeDefined();
        expect(typeof recordingId).toBe('number');
        
        // Verify recording was created in DB
        const recording = RecordingModel.findById(recordingId);
        expect(recording).toBeDefined();
        expect(recording?.streamer_username).toBe('testuser');
        expect(recording?.stream_title).toBe('Test Stream');
        expect(recording?.stream_category).toBe('Just Chatting');
        
        // Verify streamlink was spawned
        expect(mockSpawnImplementation).toHaveBeenCalledWith(
          'streamlink',
          expect.arrayContaining([
            '--twitch-disable-ads',
            '--twitch-low-latency',
            '-o',
            expect.stringContaining('testuser'),
            'https://twitch.tv/testuser',
            'best',
          ])
        );
      });

      it('should emit recordingStarted event', async () => {
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
        });
        
        const streamer = StreamerModel.create({ username: 'testuser' });
        
        const eventHandler = vi.fn();
        service.on('recordingStarted', eventHandler);
        
        const recordingId = await service.startRecording(streamer.id);
        
        expect(eventHandler).toHaveBeenCalledWith(expect.objectContaining({
          recordingId,
          streamerId: streamer.id,
          username: 'testuser',
        }));
      });

      it('should create recording log', async () => {
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
        });
        
        const streamer = StreamerModel.create({ username: 'testuser' });
        
        const recordingId = await service.startRecording(streamer.id);
        
        // Check logs were created
        const logs = RecordingLogModel.findAll({ recordingId });
        expect(logs.length).toBeGreaterThan(0);
        expect(logs.some(l => l.message.includes('Started recording'))).toBe(true);
      });

      it('should update stats', async () => {
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
        });
        
        const streamer = StreamerModel.create({ username: 'testuser' });
        
        await service.startRecording(streamer.id);
        
        const stats = StatsModel.get();
        expect(stats.active_recordings).toBe(1);
      });

      it('should use streamer quality preference', async () => {
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
        });
        
        const streamer = StreamerModel.create({
          username: 'testuser',
          quality_preference: '720p',
        });
        
        await service.startRecording(streamer.id);
        
        expect(mockSpawnImplementation).toHaveBeenCalledWith(
          'streamlink',
          expect.arrayContaining(['720p'])
        );
      });
    });

    describe('stopRecording', () => {
      it('should return false if not recording', async () => {
        const result = await service.stopRecording(999);
        expect(result).toBe(false);
      });

      it('should kill the recording process', async () => {
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
        });
        
        const streamer = StreamerModel.create({ username: 'testuser' });
        
        await service.startRecording(streamer.id);
        
        const result = await service.stopRecording(streamer.id);
        
        expect(result).toBe(true);
      });

      it('should emit recordingEnded event', async () => {
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
        });
        
        const streamer = StreamerModel.create({ username: 'testuser' });
        
        const eventHandler = vi.fn();
        service.on('recordingEnded', eventHandler);
        
        await service.startRecording(streamer.id);
        await service.stopRecording(streamer.id);
        
        // Wait for process to end
        await new Promise(r => setTimeout(r, 100));
        
        expect(eventHandler).toHaveBeenCalled();
      });
    });

    describe('isRecording', () => {
      it('should return false when not recording', () => {
        expect(service.isRecording(1)).toBe(false);
      });

      it('should return true when recording', async () => {
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
        });
        
        const streamer = StreamerModel.create({ username: 'testuser' });
        
        await service.startRecording(streamer.id);
        
        expect(service.isRecording(streamer.id)).toBe(true);
      });
    });

    describe('getActiveRecordings', () => {
      it('should return empty array when no recordings', () => {
        expect(service.getActiveRecordings()).toEqual([]);
      });

      it('should return active recordings', async () => {
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
        });
        
        const streamer = StreamerModel.create({ username: 'testuser' });
        
        await service.startRecording(streamer.id);
        
        const active = service.getActiveRecordings();
        
        expect(active).toHaveLength(1);
        expect(active[0]).toMatchObject({
          streamerId: streamer.id,
          username: 'testuser',
        });
        expect(active[0].recordingId).toBeDefined();
        expect(active[0].startTime).toBeInstanceOf(Date);
        expect(active[0].filePath).toBeDefined();
      });
    });

    describe('getActiveCount', () => {
      it('should return 0 when no recordings', () => {
        expect(service.getActiveCount()).toBe(0);
      });

      it('should return correct count', async () => {
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
        });
        
        const streamer1 = StreamerModel.create({ username: 'user1' });
        const streamer2 = StreamerModel.create({ username: 'user2' });
        
        await service.startRecording(streamer1.id);
        await service.startRecording(streamer2.id);
        
        expect(service.getActiveCount()).toBe(2);
      });
    });
  });

  describe('Auto-Recording', () => {
    describe('checkAndRecordStreamers', () => {
      it('should skip if check already in progress', async () => {
        mockSpawnImplementation = vi.fn(() => createMockProcess({
          isLive: true,
          delayMs: 100,
        }));
        
        StreamerModel.create({ username: 'testuser' });
        
        // Start first check
        const promise1 = service.checkAndRecordStreamers();
        // Start second check immediately (should skip)
        const promise2 = service.checkAndRecordStreamers();
        
        await Promise.all([promise1, promise2]);
        
        // First check should spawn at least once for metadata check
        // Second check should be skipped due to checkInProgress flag
        expect(mockSpawnImplementation).toHaveBeenCalled();
      });

      it('should skip streamers without auto_record', async () => {
        mockSpawnImplementation = vi.fn(() => createMockProcess({ isLive: true }));
        
        StreamerModel.create({
          username: 'testuser',
          auto_record: false,
        });
        
        await service.checkAndRecordStreamers();
        
        expect(mockSpawnImplementation).not.toHaveBeenCalled();
      });

      it('should skip inactive streamers', async () => {
        mockSpawnImplementation = vi.fn(() => createMockProcess({ isLive: true }));
        
        const streamer = StreamerModel.create({ username: 'testuser' });
        StreamerModel.update(streamer.id, { is_active: false });
        
        await service.checkAndRecordStreamers();
        
        expect(mockSpawnImplementation).not.toHaveBeenCalled();
      });

      it('should start recording for live streamers', async () => {
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
        });
        
        const streamer = StreamerModel.create({ username: 'testuser' });
        
        await service.checkAndRecordStreamers();
        
        // Should spawn streamlink for metadata check AND for recording
        expect(mockSpawnImplementation).toHaveBeenCalled();
        expect(service.isRecording(streamer.id)).toBe(true);
      });

      it('should skip offline streamers', async () => {
        mockSpawnImplementation = vi.fn(() => createMockProcess({ isLive: false }));
        
        StreamerModel.create({ username: 'testuser' });
        
        await service.checkAndRecordStreamers();
        
        expect(service.getActiveCount()).toBe(0);
      });

      it('should skip already recording streamers', async () => {
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
        });
        
        StreamerModel.create({ username: 'testuser' });
        
        // First check starts recording
        await service.checkAndRecordStreamers();
        
        // Second check should skip
        await service.checkAndRecordStreamers();
        
        expect(service.getActiveCount()).toBe(1);
      });
    });
  });

  describe('Shutdown', () => {
    it('should stop all recordings', async () => {
      mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
        const isMetadataCheck = args.includes('--json');
        return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
      });
      
      const streamer1 = StreamerModel.create({ username: 'user1' });
      const streamer2 = StreamerModel.create({ username: 'user2' });
      
      await service.startRecording(streamer1.id);
      await service.startRecording(streamer2.id);
      
      expect(service.getActiveCount()).toBe(2);
      
      await service.shutdown();
      
      expect(service.getActiveCount()).toBe(0);
    });

    it('should update recording statuses in database', async () => {
      mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
        const isMetadataCheck = args.includes('--json');
        return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
      });
      
      const streamer = StreamerModel.create({ username: 'testuser' });
      const recordingId = await service.startRecording(streamer.id);
      
      // Wait a bit to ensure duration > 0
      await new Promise(r => setTimeout(r, 100));
      
      await service.shutdown();
      
      const recording = RecordingModel.findById(recordingId);
      expect(recording?.status).toBe('completed');
      expect(recording?.ended_at).toBeDefined();
    });

    it('should update stats', async () => {
      mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
        const isMetadataCheck = args.includes('--json');
        return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
      });
      
      const streamer = StreamerModel.create({ username: 'testuser' });
      await service.startRecording(streamer.id);
      
      await service.shutdown();
      
      const stats = StatsModel.get();
      expect(stats.active_recordings).toBe(0);
    });

    it('should stop auto checker', async () => {
      vi.useFakeTimers();
      
      service.startAutoChecker(60000);
      await service.shutdown();
      
      // Should not have interval running
      vi.advanceTimersByTime(120000);
      expect(mockSpawnImplementation).not.toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    it('should handle multiple shutdown calls gracefully', async () => {
      mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
        const isMetadataCheck = args.includes('--json');
        return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
      });
      
      const streamer = StreamerModel.create({ username: 'testuser' });
      await service.startRecording(streamer.id);
      
      await service.shutdown();
      await service.shutdown(); // Second call should be no-op
      
      expect(service.getActiveCount()).toBe(0);
    });
  });

  describe('Utility Methods', () => {
    describe('getTotalDownloadSpeed', () => {
      it('should return 0 MB/s when no recordings', () => {
        expect(service.getTotalDownloadSpeed()).toBe('0 MB/s');
      });

      it('should return estimated speed for active recordings', async () => {
        mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
          const isMetadataCheck = args.includes('--json');
          return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
        });
        
        const streamer1 = StreamerModel.create({ username: 'user1' });
        const streamer2 = StreamerModel.create({ username: 'user2' });
        
        await service.startRecording(streamer1.id);
        await service.startRecording(streamer2.id);
        
        expect(service.getTotalDownloadSpeed()).toBe('~12 MB/s');
      });
    });

    describe('getDiskSpaceStatus', () => {
      it('should return disk space status', () => {
        const status = service.getDiskSpaceStatus();
        
        expect(status).toMatchObject({
          total: expect.any(String),
          used: expect.any(String),
          free: expect.any(String),
          usedPercentage: expect.any(Number),
          status: expect.any(String),
        });
      });
    });
  });

  describe('Disk Space Checks', () => {
    it('should block recording when disk space is insufficient', async () => {
      const mockedDiskSpace = vi.mocked(diskSpace);
      mockedDiskSpace.checkDiskSpaceForRecording.mockReturnValueOnce({
        allowed: false,
        reason: 'Insufficient disk space',
        freeSpaceMb: 100,
        usedPercentage: 95,
      });

      const streamer = StreamerModel.create({ username: 'testuser' });

      await expect(service.startRecording(streamer.id)).rejects.toThrow('Insufficient disk space');
    });

    it('should log disk space warning when recording starts', async () => {
      mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
        const isMetadataCheck = args.includes('--json');
        return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
      });

      const streamer = StreamerModel.create({ username: 'testuser' });
      const recordingId = await service.startRecording(streamer.id);

      // Check that disk space log was created
      const logs = RecordingLogModel.findAll({ recordingId });
      expect(logs.some(l => l.message.includes('Disk space:'))).toBe(true);
    });

    it('should skip auto-recording when disk space is insufficient', async () => {
      const mockedDiskSpace = vi.mocked(diskSpace);
      mockedDiskSpace.checkDiskSpaceForRecording.mockReturnValueOnce({
        allowed: false,
        reason: 'Insufficient disk space',
        freeSpaceMb: 100,
        usedPercentage: 95,
      });

      mockSpawnImplementation = vi.fn(() => createMockProcess({ isLive: true }));

      StreamerModel.create({ username: 'testuser' });

      await service.checkAndRecordStreamers();

      // Should not have started recording due to disk space check
      expect(service.getActiveCount()).toBe(0);
    });
  });

  describe('Shutdown Race Condition', () => {
    it('should prevent handleRecordingEnd from running after shutdown starts', async () => {
      mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
        const isMetadataCheck = args.includes('--json');
        return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
      });

      const streamer = StreamerModel.create({ username: 'testuser' });
      const recordingId = await service.startRecording(streamer.id);

      // Start shutdown (this should clear the active recordings map)
      const shutdownPromise = service.shutdown();

      // Immediately after shutdown starts, check that the recording is being handled
      expect(service.getActiveCount()).toBe(0);

      await shutdownPromise;

      // Verify recording status in DB
      const recording = RecordingModel.findById(recordingId);
      expect(recording?.status).toBe('completed');
    });

    it('should handle concurrent shutdown calls', async () => {
      mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
        const isMetadataCheck = args.includes('--json');
        return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
      });

      const streamer1 = StreamerModel.create({ username: 'user1' });
      const streamer2 = StreamerModel.create({ username: 'user2' });

      await service.startRecording(streamer1.id);
      await service.startRecording(streamer2.id);

      // Call shutdown multiple times concurrently
      const [result1, result2, result3] = await Promise.all([
        service.shutdown(),
        service.shutdown(),
        service.shutdown(),
      ]);

      // All should resolve without error
      expect(service.getActiveCount()).toBe(0);
    });

    it('should not start new recordings during shutdown', async () => {
      mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
        const isMetadataCheck = args.includes('--json');
        return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
      });

      const streamer = StreamerModel.create({ username: 'testuser' });

      // Start shutdown
      const shutdownPromise = service.shutdown();

      // Try to start recording during shutdown
      await expect(service.startRecording(streamer.id)).rejects.toThrow('service is shutting down');

      await shutdownPromise;
    });

    it('should not check for streamers during shutdown', async () => {
      mockSpawnImplementation = vi.fn(() => createMockProcess({ isLive: true }));

      StreamerModel.create({ username: 'testuser' });

      // Start shutdown
      const shutdownPromise = service.shutdown();

      // Try to check for streamers during shutdown
      await service.checkAndRecordStreamers(); // Should return early without error

      await shutdownPromise;

      // No recordings should have started
      expect(service.getActiveCount()).toBe(0);
    });
  });
});
