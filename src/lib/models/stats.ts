import db from '../db';
import { RecordingModel } from './recording';
import { StreamerModel } from './streamer';

export interface Stats {
  id: number;
  total_downloaded_bytes: number;
  total_recordings: number;
  total_streamers: number;
  active_recordings: number;
  updated_at: string;
}

export interface SystemStats {
  totalDownloaded: string;
  activeRecordings: number;
  totalStreamers: number;
  totalRecordings: number;
  recordingStats: {
    total: number;
    recording: number;
    completed: number;
    error: number;
    stopped: number;
  };
}

export const StatsModel = {
  // Get current stats
  get(): Stats {
    const stmt = db.prepare('SELECT * FROM stats WHERE id = 1');
    return stmt.get() as Stats;
  },

  // Update stats
  update(updates: Partial<Omit<Stats, 'id' | 'updated_at'>>): void {
    const sets: string[] = [];
    const values: any[] = [];

    if (updates.total_downloaded_bytes !== undefined) {
      sets.push('total_downloaded_bytes = ?');
      values.push(updates.total_downloaded_bytes);
    }
    if (updates.total_recordings !== undefined) {
      sets.push('total_recordings = ?');
      values.push(updates.total_recordings);
    }
    if (updates.total_streamers !== undefined) {
      sets.push('total_streamers = ?');
      values.push(updates.total_streamers);
    }
    if (updates.active_recordings !== undefined) {
      sets.push('active_recordings = ?');
      values.push(updates.active_recordings);
    }

    if (sets.length === 0) return;

    sets.push('updated_at = CURRENT_TIMESTAMP');

    const stmt = db.prepare(`UPDATE stats SET ${sets.join(', ')} WHERE id = 1`);
    stmt.run(...values);
  },

  // Recalculate all stats
  recalculate(): void {
    const totalStreamers = StreamerModel.count();
    const recordingStats = RecordingModel.getStats();
    const totalDownloaded = RecordingModel.getTotalDownloaded();

    this.update({
      total_streamers: totalStreamers,
      total_recordings: recordingStats.total,
      active_recordings: recordingStats.recording,
      total_downloaded_bytes: totalDownloaded,
    });
  },

  // Get formatted system stats
  getSystemStats(): SystemStats {
    this.recalculate();
    const stats = this.get();
    const recordingStats = RecordingModel.getStats();

    return {
      totalDownloaded: formatBytes(stats.total_downloaded_bytes),
      activeRecordings: stats.active_recordings,
      totalStreamers: stats.total_streamers,
      totalRecordings: stats.total_recordings,
      recordingStats,
    };
  },
};

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
