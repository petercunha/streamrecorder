import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { RecordingModel, RecordingLogModel, StreamerModel, StatsModel } from '../models';
import { EventEmitter } from 'events';
import { checkDiskSpaceForRecording, getDiskSpaceStatus, getMaxRecordingSizeMb, getMaxRecordingDurationMs } from '../utils/disk-space';

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || path.join(process.cwd(), 'recordings');

interface ActiveRecording {
  process: ChildProcess;
  recordingId: number;
  streamerId: number;
  username: string;
  startTime: Date;
  filePath: string;
  fileSizeCheckInterval?: NodeJS.Timeout;
  durationCheckInterval?: NodeJS.Timeout;
}

export class RecordingService extends EventEmitter {
  private activeRecordings: Map<number, ActiveRecording> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private checkInProgress = false;
  private shutdownPromise: Promise<void> | null = null;

  constructor() {
    super();
    // Ensure recordings directory exists
    if (!fs.existsSync(RECORDINGS_DIR)) {
      fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
    }
  }

  // Graceful shutdown - stop all active recordings
  async shutdown(): Promise<void> {
    // If already shutting down, return the existing promise
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    // If already shut down, return immediately
    if (this.isShuttingDown) {
      return;
    }

    // Create the shutdown promise
    this.shutdownPromise = this.performShutdown();
    return this.shutdownPromise;
  }

  // Internal shutdown implementation
  private async performShutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    console.log('Shutting down recording service...');
    
    // Stop the auto checker
    this.stopAutoChecker();
    
    // Stop all active recordings
    const activeRecordings = Array.from(this.activeRecordings.values());
    if (activeRecordings.length > 0) {
      console.log(`Stopping ${activeRecordings.length} active recording(s)...`);
      
      // First, update all active recordings in DB to completed status
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
        
        // Update recording status in DB immediately to 'completed' as requested
        RecordingModel.update(recording.recordingId, {
          status: 'completed',
          ended_at: endTime.toISOString(),
          duration_seconds: durationSeconds,
          file_size_bytes: fileSizeBytes,
        });
        
        RecordingLogModel.create({
          recording_id: recording.recordingId,
          streamer_username: recording.username,
          message: `Recording completed (server shutdown). Duration: ${durationSeconds}s`,
          level: 'success',
        });
        
        console.log(`Updated recording ${recording.recordingId} for ${recording.username} to completed status`);
      }
      
      // Update stats
      StatsModel.update({ active_recordings: 0 });
      
      // Clear all intervals first to prevent checks during shutdown
      for (const recording of activeRecordings) {
        if (recording.fileSizeCheckInterval) {
          clearInterval(recording.fileSizeCheckInterval);
        }
        if (recording.durationCheckInterval) {
          clearInterval(recording.durationCheckInterval);
        }
      }
      
      // Remove all from map BEFORE killing processes to prevent handleRecordingEnd from running
      // This prevents the handleRecordingEnd callback from updating the DB again
      const recordingsToStop = [...activeRecordings];
      this.activeRecordings.clear();
      
      // Now kill the processes
      const stopPromises = recordingsToStop.map(recording => {
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
      
      console.log('All recordings stopped and database updated');
    }
    
    console.log('Recording service shutdown complete');
  }

  // Start the auto-recording checker
  startAutoChecker(intervalMs: number = 60000): void {
    if (this.isShuttingDown) {
      console.log('Cannot start auto checker: service is shutting down');
      return;
    }

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

    // Don't start new recordings during shutdown
    if (this.isShuttingDown) {
      console.log('Service is shutting down, skipping check...');
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
          
          // Check disk space before starting
          const diskCheck = checkDiskSpaceForRecording(RECORDINGS_DIR);
          if (!diskCheck.allowed) {
            console.error(`Cannot start recording for ${streamer.username}: ${diskCheck.reason}`);
            RecordingLogModel.create({
              streamer_username: streamer.username,
              message: `Recording blocked: ${diskCheck.reason}`,
              level: 'error',
            });
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
    // Don't start new recordings during shutdown
    if (this.isShuttingDown) {
      throw new Error('Cannot start recording: service is shutting down');
    }

    const streamer = StreamerModel.findById(streamerId);
    if (!streamer) {
      throw new Error('Streamer not found');
    }

    // Check if already recording
    if (this.isRecording(streamerId)) {
      throw new Error('Already recording this streamer');
    }

    // Check disk space before starting
    const diskCheck = checkDiskSpaceForRecording(RECORDINGS_DIR);
    if (!diskCheck.allowed) {
      RecordingLogModel.create({
        streamer_username: streamer.username,
        message: `Recording blocked: ${diskCheck.reason}`,
        level: 'error',
      });
      throw new Error(`Cannot start recording: ${diskCheck.reason}`);
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

    // Set up file size monitoring to update database and check limits
    activeRecording.fileSizeCheckInterval = setInterval(() => {
      this.updateRecordingFileSize(streamerId);
    }, 5000); // Update every 5 seconds

    // Set up duration monitoring if limit is configured
    const maxRecordingDurationMs = getMaxRecordingDurationMs();
    if (maxRecordingDurationMs > 0) {
      activeRecording.durationCheckInterval = setInterval(() => {
        this.checkRecordingDuration(streamerId);
      }, 60000); // Check every minute
    }

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

    // Log disk space info
    const diskStatus = getDiskSpaceStatus(RECORDINGS_DIR);
    RecordingLogModel.create({
      recording_id: recording.id,
      streamer_username: streamer.username,
      message: `Disk space: ${diskStatus.free} free (${diskStatus.usedPercentage}% used)`,
      level: diskStatus.status === 'ok' ? 'info' : diskStatus.status === 'warning' ? 'warn' : 'error',
    });

    this.emit('recordingStarted', { recordingId: recording.id, streamerId, username: streamer.username });

    return recording.id;
  }

  // Update recording file size in database and check limits
  private updateRecordingFileSize(streamerId: number): void {
    const recording = this.activeRecordings.get(streamerId);
    if (!recording) return;

    try {
      const stats = fs.statSync(recording.filePath);
      const fileSizeBytes = stats.size;
      const fileSizeMb = fileSizeBytes / (1024 * 1024);

      // Always update the database with current file size
      RecordingModel.update(recording.recordingId, {
        file_size_bytes: fileSizeBytes,
      });

      // Check if size limit is exceeded
      const maxRecordingSizeMb = getMaxRecordingSizeMb();
      if (maxRecordingSizeMb > 0 && fileSizeMb >= maxRecordingSizeMb) {
        console.log(`Recording ${recording.recordingId} exceeded max size (${fileSizeMb.toFixed(0)}MB >= ${maxRecordingSizeMb}MB), stopping...`);
        RecordingLogModel.create({
          recording_id: recording.recordingId,
          streamer_username: recording.username,
          message: `Recording stopped: exceeded maximum file size limit (${maxRecordingSizeMb}MB)`,
          level: 'warn',
        });
        this.stopRecording(streamerId);
      }
    } catch (error) {
      // File might not exist yet
    }
  }

  // Check if recording duration exceeds limit
  private checkRecordingDuration(streamerId: number): void {
    const maxRecordingDurationMs = getMaxRecordingDurationMs();
    const recording = this.activeRecordings.get(streamerId);
    if (!recording || maxRecordingDurationMs <= 0) return;

    const durationMs = Date.now() - recording.startTime.getTime();
    if (durationMs >= maxRecordingDurationMs) {
      const hours = (maxRecordingDurationMs / (60 * 60 * 1000)).toFixed(1);
      console.log(`Recording ${recording.recordingId} exceeded max duration (${hours}h), stopping...`);
      RecordingLogModel.create({
        recording_id: recording.recordingId,
        streamer_username: recording.username,
        message: `Recording stopped: exceeded maximum duration limit (${hours} hours)`,
        level: 'warn',
      });
      this.stopRecording(streamerId);
    }
  }

  // Stop a recording
  async stopRecording(streamerId: number): Promise<boolean> {
    const recording = this.activeRecordings.get(streamerId);
    if (!recording) {
      return false;
    }

    // Clear monitoring intervals
    if (recording.fileSizeCheckInterval) {
      clearInterval(recording.fileSizeCheckInterval);
    }
    if (recording.durationCheckInterval) {
      clearInterval(recording.durationCheckInterval);
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
    // Don't process recording end if we're shutting down (shutdown already handled everything)
    if (this.isShuttingDown) {
      return;
    }

    const recording = this.activeRecordings.get(streamerId);
    if (!recording) return;

    // Clear monitoring intervals
    if (recording.fileSizeCheckInterval) {
      clearInterval(recording.fileSizeCheckInterval);
    }
    if (recording.durationCheckInterval) {
      clearInterval(recording.durationCheckInterval);
    }

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
    
    // Estimate ~6 MB/s per 1080p60 stream
    const estimatedSpeed = activeCount * 6;
    return `~${estimatedSpeed} MB/s`;
  }

  // Get disk space status
  getDiskSpaceStatus() {
    return getDiskSpaceStatus(RECORDINGS_DIR);
  }

  // Get current file size for an active recording (real-time)
  getRecordingFileSize(streamerId: number): number {
    const recording = this.activeRecordings.get(streamerId);
    if (!recording) return 0;

    try {
      const stats = fs.statSync(recording.filePath);
      return stats.size;
    } catch (error) {
      // File might not exist yet
      return 0;
    }
  }

  // Reset method for tests - clears all internal state
  reset(): void {
    this.activeRecordings.clear();
    this.checkInProgress = false;
    this.isShuttingDown = false;
    this.shutdownPromise = null;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.removeAllListeners();
  }
}

export const recordingService = new RecordingService();
export default recordingService;
