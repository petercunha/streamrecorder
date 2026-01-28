import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { RecordingModel, RecordingLogModel, StreamerModel, StatsModel } from '../models';
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
  private checkInProgress = false;

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
    const activeRecordings = Array.from(this.activeRecordings.values());
    if (activeRecordings.length > 0) {
      console.log(`Stopping ${activeRecordings.length} active recording(s)...`);
      
      // First, update all active recordings in DB to stopped status
      // This ensures DB is consistent even if process exits before handlers run
      const endTime = new Date();
      for (const recording of activeRecordings) {
        const durationSeconds = Math.floor((endTime.getTime() - recording.startTime.getTime()) / 1000);
        
        // Get file size if available
        let fileSizeBytes = 0;
        try {
          const stats = fs.statSync(recording.filePath);
          fileSizeBytes = stats.size;
        } catch {
          // File might not exist if recording failed
        }
        
        // Update recording status in DB immediately
        RecordingModel.update(recording.recordingId, {
          status: 'stopped',
          ended_at: endTime.toISOString(),
          duration_seconds: durationSeconds,
          file_size_bytes: fileSizeBytes,
        });
        
        RecordingLogModel.create({
          recording_id: recording.recordingId,
          streamer_username: recording.username,
          message: `Recording stopped due to server shutdown. Duration: ${durationSeconds}s`,
          level: 'warn',
        });
        
        console.log(`Updated recording ${recording.recordingId} for ${recording.username} to stopped status`);
      }
      
      // Update stats
      StatsModel.update({ active_recordings: 0 });
      
      // Now kill the processes
      const stopPromises = activeRecordings.map(recording => {
        return new Promise<void>((resolve) => {
          // Force kill after 2 seconds if not stopped
          const timeout = setTimeout(() => {
            if (!recording.process.killed) {
              recording.process.kill('SIGKILL');
            }
            resolve();
          }, 2000);
          
          recording.process.on('close', () => {
            clearTimeout(timeout);
            resolve();
          });
          
          recording.process.kill('SIGTERM');
        });
      });
      
      await Promise.all(stopPromises);
      
      // Clear the active recordings map since we've updated the DB
      this.activeRecordings.clear();
      
      console.log('All recordings stopped and database updated');
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
    // Prevent concurrent checks
    if (this.checkInProgress) {
      console.log('Check already in progress, skipping...');
      return;
    }
    
    this.checkInProgress = true;
    
    try {
      const streamers = StreamerModel.findAll();
      
      for (const streamer of streamers) {
        if (!streamer.auto_record) continue;
        
        // Double-check if already recording (in-memory check)
        if (this.isRecording(streamer.id)) {
          console.log(`Already recording ${streamer.username}, skipping...`);
          continue;
        }
        
        // Also check database for any active recordings
        const existingRecording = RecordingModel.findActiveByStreamer(streamer.id);
        if (existingRecording) {
          console.log(`Found existing active recording for ${streamer.username} in DB, skipping...`);
          continue;
        }

        // Check if streamer is live
        const isLive = await this.checkIfLive(streamer.username);
        
        if (isLive) {
          // Final check before starting to prevent race conditions
          if (this.isRecording(streamer.id)) {
            console.log(`Recording for ${streamer.username} started by another check, skipping...`);
            continue;
          }
          
          try {
            console.log(`Starting recording for ${streamer.username}...`);
            await this.startRecording(streamer.id);
            console.log(`Successfully started recording for ${streamer.username}`);
          } catch (error) {
            console.error(`Failed to start recording for ${streamer.username}:`, error);
          }
        }
      }
    } finally {
      this.checkInProgress = false;
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
    
    // Update stats in database to reflect the actual in-memory active recordings count
    StatsModel.update({ active_recordings: this.activeRecordings.size });

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
    
    // Update stats in database to reflect the actual in-memory active recordings count
    StatsModel.update({ active_recordings: this.activeRecordings.size });

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
