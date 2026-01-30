import { describe, it, expect, beforeEach, afterAll, vi, beforeAll } from 'vitest';
import { EventEmitter } from 'events';
import { clearTestDb, getTestDb } from '../db-mock';
import { RecordingService } from '@/lib/services/recording-service';
import { StreamerModel } from '@/lib/models/streamer';
import { RecordingModel } from '@/lib/models/recording';
import { RecordingLogModel } from '@/lib/models/recording-log';
import { StatsModel } from '@/lib/models/stats';

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
    statSync: vi.fn(() => ({ size: 1024 * 1024 * 10 })),
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

describe('Integration Tests', () => {
  beforeAll(() => {
    // Initialize database
    getTestDb();
  });

  beforeEach(() => {
    clearTestDb();
    
    // Clear any lingering mock processes
    activeMockProcesses.forEach(p => p._forceClose());
    activeMockProcesses.clear();

    // Default mock implementation
    mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
      const isMetadataCheck = args.includes('--json');
      return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
    });
  });

  afterAll(() => {
    activeMockProcesses.forEach(p => p._forceClose());
    activeMockProcesses.clear();
    const db = getTestDb();
    db.close();
  });

  describe('Database Integration', () => {
    it('should enforce foreign key constraints', () => {
      // Try to create recording without streamer
      expect(() => {
        RecordingModel.create({
          streamer_id: 999999,
          file_path: 'test.mp4',
        });
      }).toThrow();
    });

    it('should cascade delete recordings when streamer is deleted', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      const recording = RecordingModel.create({
        streamer_id: streamer.id,
        file_path: 'test.mp4',
      });

      // Verify recording exists
      expect(RecordingModel.findById(recording.id)).toBeDefined();

      // Delete streamer
      StreamerModel.delete(streamer.id);

      // Recording should be deleted
      expect(RecordingModel.findById(recording.id)).toBeUndefined();
    });

    it('should cascade delete logs when recording is deleted', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      const recording = RecordingModel.create({
        streamer_id: streamer.id,
        file_path: 'test.mp4',
      });
      RecordingLogModel.create({
        recording_id: recording.id,
        message: 'Test log',
      });

      // Verify log exists
      expect(RecordingLogModel.findAll({ recordingId: recording.id })).toHaveLength(1);

      // Delete recording
      RecordingModel.delete(recording.id);

      // Log should be deleted
      expect(RecordingLogModel.findAll({ recordingId: recording.id })).toHaveLength(0);
    });

    it('should maintain stats table with single row', () => {
      const stats1 = StatsModel.get();
      expect(stats1.id).toBe(1);

      StatsModel.update({ total_recordings: 10 });

      const stats2 = StatsModel.get();
      expect(stats2.id).toBe(1);
      expect(stats2.total_recordings).toBe(10);
    });
  });

  describe('Recording Lifecycle', () => {
    it('should complete full recording lifecycle', async () => {
      // 1. Create streamer with auto_record
      const streamer = StreamerModel.create({
        username: 'testuser',
        auto_record: true,
      });

      // 2. Mock streamlink as live
      mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
        const isMetadataCheck = args.includes('--json');
        return createMockProcess({ 
          isLive: true, 
          title: 'Test Stream',
          category: 'Gaming',
          delayMs: 10, 
          longRunning: !isMetadataCheck 
        });
      });

      // 3. Create service and trigger check
      const service = new RecordingService();

      await service.checkAndRecordStreamers();

      // 4. Verify recording started
      expect(service.isRecording(streamer.id)).toBe(true);
      expect(RecordingModel.getActiveCount()).toBe(1);

      const recordings = RecordingModel.findAll();
      expect(recordings).toHaveLength(1);
      expect(recordings[0].status).toBe('recording');
      expect(recordings[0].stream_title).toBe('Test Stream');
      expect(recordings[0].stream_category).toBe('Gaming');

      // 5. Verify stats updated
      const stats = StatsModel.get();
      expect(stats.active_recordings).toBe(1);

      // 6. Stop recording
      await service.stopRecording(streamer.id);

      // Wait for process to end and handleRecordingEnd to complete
      await new Promise(r => setTimeout(r, 100));

      // 7. Verify recording completed
      const recording = RecordingModel.findById(recordings[0].id);
      expect(recording?.status).toBe('completed');
      expect(recording?.ended_at).toBeDefined();

      // 8. Verify stats updated
      const finalStats = StatsModel.get();
      expect(finalStats.active_recordings).toBe(0);

      // 9. Verify logs created
      const logs = RecordingLogModel.findAll({ recordingId: recordings[0].id });
      expect(logs.length).toBeGreaterThan(0);

      await service.shutdown();
    });

    it('should handle multiple concurrent recordings', async () => {
      // Create multiple streamers
      const streamer1 = StreamerModel.create({ username: 'user1', auto_record: true });
      const streamer2 = StreamerModel.create({ username: 'user2', auto_record: true });
      const streamer3 = StreamerModel.create({ username: 'user3', auto_record: true });

      mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
        const isMetadataCheck = args.includes('--json');
        return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
      });

      const service = new RecordingService();

      // Start all recordings
      await service.startRecording(streamer1.id);
      await service.startRecording(streamer2.id);
      await service.startRecording(streamer3.id);

      // Verify all are recording
      expect(service.getActiveCount()).toBe(3);
      expect(RecordingModel.getActiveCount()).toBe(3);

      // Stop all via shutdown
      await service.shutdown();

      // Verify all stopped
      expect(service.getActiveCount()).toBe(0);

      const recordings = RecordingModel.findAll();
      expect(recordings).toHaveLength(3);
      recordings.forEach(r => {
        expect(r.status).toBe('completed');
        expect(r.ended_at).toBeDefined();
      });
    });

    it('should not start duplicate recordings', async () => {
      const streamer = StreamerModel.create({ username: 'testuser', auto_record: true });

      mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
        const isMetadataCheck = args.includes('--json');
        return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
      });

      const service = new RecordingService();

      // Start first recording
      await service.startRecording(streamer.id);

      // Try to start again - should throw immediately
      await expect(service.startRecording(streamer.id)).rejects.toThrow('Already recording this streamer');

      // Try checkAndRecord - should skip
      await service.checkAndRecordStreamers();

      // Should still only have one recording
      expect(service.getActiveCount()).toBe(1);

      await service.shutdown();
    });
  });

  describe('Graceful Shutdown', () => {
    it('should clean up orphaned recordings on startup', async () => {
      // Simulate orphaned recordings (status = 'recording' but no actual process)
      const streamer = StreamerModel.create({ username: 'testuser' });
      const recording = RecordingModel.create({
        streamer_id: streamer.id,
        file_path: 'test.mp4',
      });

      // Recording is in 'recording' state but no process exists
      expect(RecordingModel.findById(recording.id)?.status).toBe('recording');

      // Run cleanup (this simulates what happens in instrumentation.ts)
      const activeRecordings = RecordingModel.findAll({ status: 'recording' });
      for (const r of activeRecordings) {
        RecordingModel.update(r.id, {
          status: 'stopped',
          ended_at: new Date().toISOString(),
          duration_seconds: 0,
        });
      }
      StatsModel.update({ active_recordings: 0 });

      // Verify cleaned up
      const updated = RecordingModel.findById(recording.id);
      expect(updated?.status).toBe('stopped');
      expect(updated?.ended_at).toBeDefined();

      const stats = StatsModel.get();
      expect(stats.active_recordings).toBe(0);
    });

    it('should handle service shutdown correctly', async () => {
      const streamer = StreamerModel.create({ username: 'testuser' });

      mockSpawnImplementation = vi.fn((command: string, args: string[]) => {
        const isMetadataCheck = args.includes('--json');
        return createMockProcess({ isLive: true, delayMs: 10, longRunning: !isMetadataCheck });
      });

      const service = new RecordingService();
      const recordingId = await service.startRecording(streamer.id);

      // Wait a bit to ensure duration > 0
      await new Promise(r => setTimeout(r, 100));

      // Verify recording is active
      expect(RecordingModel.findById(recordingId)?.status).toBe('recording');

      // Shutdown service
      await service.shutdown();

      // Verify recording is completed
      const recording = RecordingModel.findById(recordingId);
      expect(recording?.status).toBe('completed');
      expect(recording?.ended_at).toBeDefined();

      // Verify stats
      const stats = StatsModel.get();
      expect(stats.active_recordings).toBe(0);
    });
  });

  describe('Stats Consistency', () => {
    it('should keep stats consistent with actual data', () => {
      // Create streamers
      const streamer1 = StreamerModel.create({ username: 'user1' });
      const streamer2 = StreamerModel.create({ username: 'user2' });
      const streamer3 = StreamerModel.create({ username: 'user3' });

      // Create recordings
      RecordingModel.create({ streamer_id: streamer1.id, file_path: 'test1.mp4' });
      RecordingModel.create({ streamer_id: streamer2.id, file_path: 'test2.mp4' });
      const r3 = RecordingModel.create({ streamer_id: streamer3.id, file_path: 'test3.mp4' });
      RecordingModel.update(r3.id, { status: 'completed' });

      // Recalculate stats
      StatsModel.recalculate();

      // Verify stats match actual data
      const stats = StatsModel.get();
      expect(stats.total_streamers).toBe(StreamerModel.count());
      expect(stats.total_recordings).toBe(RecordingModel.getStats().total);
      expect(stats.active_recordings).toBe(RecordingModel.getStats().recording);
    });

    it('should track total downloaded correctly', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });

      const r1 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test1.mp4' });
      const r2 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test2.mp4' });
      const r3 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test3.mp4' });

      RecordingModel.update(r1.id, { file_size_bytes: 1024 * 1024 });
      RecordingModel.update(r2.id, { file_size_bytes: 2 * 1024 * 1024 });
      RecordingModel.update(r3.id, { file_size_bytes: 3 * 1024 * 1024 });

      StatsModel.recalculate();

      const stats = StatsModel.get();
      expect(stats.total_downloaded_bytes).toBe(6 * 1024 * 1024);

      const systemStats = StatsModel.getSystemStats();
      expect(systemStats.totalDownloaded).toBe('6 MB');
    });
  });

  describe('Cascade Behavior', () => {
    it('should maintain referential integrity', () => {
      // Create a streamer with recordings and logs
      const streamer = StreamerModel.create({ username: 'testuser' });
      const recording = RecordingModel.create({
        streamer_id: streamer.id,
        file_path: 'test.mp4',
      });
      RecordingLogModel.create({
        recording_id: recording.id,
        message: 'Test log',
      });

      // Delete streamer
      const deleted = StreamerModel.delete(streamer.id);
      expect(deleted).toBe(true);

      // Verify cascade
      expect(RecordingModel.findById(recording.id)).toBeUndefined();
      expect(RecordingLogModel.findAll({ recordingId: recording.id })).toHaveLength(0);
    });

    it('should allow logs without recording_id', () => {
      // Create log without recording reference
      const log = RecordingLogModel.create({
        streamer_username: 'testuser',
        message: 'System message',
      });

      expect(log.recording_id).toBeNull();
      expect(log.streamer_username).toBe('testuser');

      // Should still be retrievable
      const logs = RecordingLogModel.findAll({ streamerUsername: 'testuser' });
      expect(logs).toHaveLength(1);
    });
  });
});
