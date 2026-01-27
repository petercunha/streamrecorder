import db from '../db';

export interface RecordingLog {
  id: number;
  recording_id: number | null;
  streamer_username: string | null;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
  created_at: string;
}

export interface CreateRecordingLogInput {
  recording_id?: number;
  streamer_username?: string;
  message: string;
  level?: 'info' | 'warn' | 'error' | 'success';
}

export const RecordingLogModel = {
  // Create a new log entry
  create(input: CreateRecordingLogInput): RecordingLog {
    const stmt = db.prepare(`
      INSERT INTO recording_logs (recording_id, streamer_username, message, level)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);
    
    const result = stmt.get(
      input.recording_id || null,
      input.streamer_username || null,
      input.message,
      input.level || 'info'
    ) as RecordingLog;
    
    return result;
  },

  // Find all logs with optional filters
  findAll(filters?: {
    recordingId?: number;
    streamerUsername?: string;
    level?: string;
    limit?: number;
  }): RecordingLog[] {
    let query = 'SELECT * FROM recording_logs WHERE 1=1';
    const params: any[] = [];

    if (filters?.recordingId) {
      query += ' AND recording_id = ?';
      params.push(filters.recordingId);
    }

    if (filters?.streamerUsername) {
      query += ' AND streamer_username = ?';
      params.push(filters.streamerUsername);
    }

    if (filters?.level) {
      query += ' AND level = ?';
      params.push(filters.level);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as RecordingLog[];
  },

  // Get recent logs
  getRecent(limit: number = 50): RecordingLog[] {
    const stmt = db.prepare(`
      SELECT * FROM recording_logs
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as RecordingLog[];
  },

  // Clear old logs
  clearOld(days: number = 7): number {
    const stmt = db.prepare(`
      DELETE FROM recording_logs
      WHERE created_at < datetime('now', '-${days} days')
    `);
    const result = stmt.run();
    return result.changes;
  },
};
