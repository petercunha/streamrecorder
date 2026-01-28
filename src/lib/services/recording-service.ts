import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { RecordingModel, RecordingLogModel, StreamerModel } from '../models';
import { EventEmitter } from 'events';

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || path.join(process.cwd(), 'recordings');

interface ActiveRecording {
  process: ChildProcess;
  recordingId: number;
  streamerId: number;
  username: string;
  startTime: Date;
  filePath: string;
}

class RecordingService extends EventEmitter {
  private activeRecordings: Map<number, ActiveRecording> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    super();
    // Ensure recordings directory exists
    if (!fs.existsSync(RECORDINGS_DIR)) {
      fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
    }
  }

  // Graceful shutdown - stop all active recordings
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;
    
    console.log('Shutting down recording service...');
    
    // Stop the auto checker
    this.stopAutoChecker();
    
    // Stop all active recordings
    const activeRecordings = this.getActiveRecordings();
    if (activeRecordings.length > 0) {
      console.log(`Stopping ${activeRecordings.length} active recording(s)...`);
      
      const stopPromises = activeRecordings.map(recording => {
        return new Promise<void>((resolve) => {
          const activeRecording = this.activeRecordings.get(recording.streamerId);
          if (activeRecording) {
            // Force kill after 5 seconds if not stopped
            const timeout = setTimeout(() => {
              if (!activeRecording.process.killed) {
                activeRecording.process.kill('SIGKILL');
              }
              resolve();
            }, 5000);
            
            activeRecording.process.on('close', () => {
              clearTimeout(timeout);
              resolve();
            });
            
            activeRecording.process.kill('SIGTERM');
          } else {
            resolve();
          }
        });
      });
      
      await Promise.all(stopPromises);
      console.log('All recordings stopped');
    }
    
    console.log('Recording service shutdown complete');
  }

  // Start the auto-recording checker
  startAutoChecker(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkAndRecordStreamers();
    }, intervalMs);

    console.log('Auto-recording checker started');
  }

  // Stop the auto-recording checker
  stopAutoChecker(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('Auto-recording checker stopped');
  }

  // Check all active streamers and start recording if live
  async checkAndRecordStreamers(): Promise<void> {
    const streamers = StreamerModel.findAll();
    
    for (const streamer of streamers) {
      if (!streamer.auto_record) continue;
      
      // Skip if already recording
      if (this.isRecording(streamer.id)) {
        continue;
      }

      // Check if streamer is live
      const isLive = await this.checkIfLive(streamer.username);
      
      if (isLive) {
        try {
          await this.startRecording(streamer.id);
        } catch (error) {
          console.error(`Failed to start recording for ${streamer.username}:`, error);
        }
      }
    }
  }

  // Get stream metadata from streamlink
  async getStreamMetadata(username: string): Promise<{ title: string; category: string } | null> {
    return new Promise((resolve) => {
      const streamlink = spawn('streamlink', [
        '--json',
        `https://twitch.tv/${username}`,
        'best'
      ]);

      let output = '';
      
      streamlink.stdout.on('data', (data) => {
        output += data.toString();
      });

      streamlink.on('close', (code) => {
        try {
          const result = JSON.parse(output);
          if (result.metadata) {
            resolve({
              title: result.metadata.title || '',
              category: result.metadata.category || ''
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });

      streamlink.on('error', () => {
        resolve(null);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        streamlink.kill();
        resolve(null);
      }, 10000);
    });
  }

  // Check if a streamer is live using streamlink
  async checkIfLive(username: string): Promise<boolean> {
    return new Promise((resolve) => {
      const streamlink = spawn('streamlink', [
        '--json',
        `https://twitch.tv/${username}`,
        'best'
      ]);

      let output = '';
      
      streamlink.stdout.on('data', (data) => {
        output += data.toString();
      });

      streamlink.on('close', (code) => {
        try {
          const result = JSON.parse(output);
          // Stream is live if there's no error and we have stream info (type or url indicates stream is available)
          resolve(!result.error && (!!result.type || !!result.url));
        } catch {
          resolve(false);
        }
      });

      streamlink.on('error', () => {
        resolve(false);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        streamlink.kill();
        resolve(false);
      }, 10000);
    });
  }

  // Start recording a streamer
  async startRecording(streamerId: number): Promise<number> {
    const streamer = StreamerModel.findById(streamerId);
    if (!streamer) {
      throw new Error('Streamer not found');
    }

    // Check if already recording
    if (this.isRecording(streamerId)) {
      throw new Error('Already recording this streamer');
    }

    // Get stream metadata before starting
    const metadata = await this.getStreamMetadata(streamer.username);

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${streamer.username}_${timestamp}.mp4`;
    const filePath = path.join(RECORDINGS_DIR, filename);
    // Store relative path for web access
    const relativeFilePath = `recordings/${filename}`;

    // Create recording record with metadata (use relative path for web access)
    const recording = RecordingModel.create({
      streamer_id: streamerId,
      file_path: relativeFilePath,
      quality: streamer.quality_preference,
      stream_title: metadata?.title,
      stream_category: metadata?.category,
    });

    // Start streamlink process
    const quality = streamer.quality_preference || 'best';
    const streamlink = spawn('streamlink', [
      '--twitch-disable-ads',
      '--twitch-low-latency',
      '-o', filePath,
      `https://twitch.tv/${streamer.username}`,
      quality
    ]);

    const activeRecording: ActiveRecording = {
      process: streamlink,
      recordingId: recording.id,
      streamerId,
      username: streamer.username,
      startTime: new Date(),
      filePath,
    };

    this.activeRecordings.set(streamerId, activeRecording);

    // Handle process events
    streamlink.on('close', (code) => {
      this.handleRecordingEnd(streamerId, code);
    });

    streamlink.on('error', (error) => {
      console.error(`Streamlink error for ${streamer.username}:`, error);
      RecordingLogModel.create({
        recording_id: recording.id,
        streamer_username: streamer.username,
        message: `Error: ${error.message}`,
        level: 'error',
      });
    });

    // Log stdout
    streamlink.stdout?.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        RecordingLogModel.create({
          recording_id: recording.id,
          streamer_username: streamer.username,
          message,
          level: 'info',
        });
      }
    });

    // Log stderr
    streamlink.stderr?.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        RecordingLogModel.create({
          recording_id: recording.id,
          streamer_username: streamer.username,
          message,
          level: 'warn',
        });
      }
    });

    // Log start
    RecordingLogModel.create({
      recording_id: recording.id,
      streamer_username: streamer.username,
      message: `Started recording to ${filename}`,
      level: 'success',
    });

    this.emit('recordingStarted', { recordingId: recording.id, streamerId, username: streamer.username });

    return recording.id;
  }

  // Stop a recording
  async stopRecording(streamerId: number): Promise<boolean> {
    const recording = this.activeRecordings.get(streamerId);
    if (!recording) {
      return false;
    }

    recording.process.kill('SIGTERM');
    
    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (!recording.process.killed) {
        recording.process.kill('SIGKILL');
      }
    }, 5000);

    return true;
  }

  // Handle recording end
  private async handleRecordingEnd(streamerId: number, exitCode: number | null): Promise<void> {
    const recording = this.activeRecordings.get(streamerId);
    if (!recording) return;

    this.activeRecordings.delete(streamerId);

    const endTime = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - recording.startTime.getTime()) / 1000);

    // Get file size
    let fileSizeBytes = 0;
    try {
      const stats = fs.statSync(recording.filePath);
      fileSizeBytes = stats.size;
    } catch {
      // File might not exist if recording failed
    }

    // Update recording status
    const status = exitCode === 0 ? 'completed' : 'stopped';
    RecordingModel.update(recording.recordingId, {
      status,
      ended_at: endTime.toISOString(),
      duration_seconds: durationSeconds,
      file_size_bytes: fileSizeBytes,
    });

    // Log end
    RecordingLogModel.create({
      recording_id: recording.recordingId,
      streamer_username: recording.username,
      message: `Recording ended with code ${exitCode}. Duration: ${durationSeconds}s, Size: ${fileSizeBytes} bytes`,
      level: exitCode === 0 ? 'success' : 'warn',
    });

    this.emit('recordingEnded', { 
      recordingId: recording.recordingId, 
      streamerId, 
      username: recording.username,
      exitCode,
      durationSeconds,
      fileSizeBytes
    });
  }

  // Check if a streamer is being recorded
  isRecording(streamerId: number): boolean {
    return this.activeRecordings.has(streamerId);
  }

  // Get all active recordings
  getActiveRecordings(): Array<{
    recordingId: number;
    streamerId: number;
    username: string;
    startTime: Date;
    filePath: string;
  }> {
    return Array.from(this.activeRecordings.values()).map(r => ({
      recordingId: r.recordingId,
      streamerId: r.streamerId,
      username: r.username,
      startTime: r.startTime,
      filePath: r.filePath,
    }));
  }

  // Get active recordings count
  getActiveCount(): number {
    return this.activeRecordings.size;
  }

  // Get total download speed (approximate)
  getTotalDownloadSpeed(): string {
    // This is a simplified calculation - in a real app you'd track bytes over time
    const activeCount = this.activeRecordings.size;
    if (activeCount === 0) return '0 MB/s';
    
    // Estimate ~6 Mbps per 1080p60 stream
    const estimatedSpeed = activeCount * 6;
    return `~${estimatedSpeed} MB/s`;
  }
}

export const recordingService = new RecordingService();
export default recordingService;
