import db from '../db';

export interface Recording {
  id: number;
  streamer_id: number;
  stream_title: string | null;
  stream_category: string | null;
  file_path: string;
  file_size_bytes: number;
  duration_seconds: number;
  quality: string | null;
  started_at: string;
  ended_at: string | null;
  status: 'recording' | 'completed' | 'error' | 'stopped';
  error_message: string | null;
}

export interface CreateRecordingInput {
  streamer_id: number;
  stream_title?: string;
  stream_category?: string;
  file_path: string;
  quality?: string;
}

export interface UpdateRecordingInput {
  stream_title?: string;
  stream_category?: string;
  file_size_bytes?: number;
  duration_seconds?: number;
  quality?: string;
  ended_at?: string;
  status?: 'recording' | 'completed' | 'error' | 'stopped';
  error_message?: string;
}

export interface RecordingWithStreamer extends Recording {
  streamer_username: string;
  streamer_display_name: string;
}

export const RecordingModel = {
  // Create a new recording
  create(input: CreateRecordingInput): Recording {
    const stmt = db.prepare(`
      INSERT INTO recordings (streamer_id, stream_title, stream_category, file_path, quality)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);
    
    const result = stmt.get(
      input.streamer_id,
      input.stream_title || null,
      input.stream_category || null,
      input.file_path,
      input.quality || null
    ) as Recording;
    
    return result;
  },

  // Find all recordings with optional filters
  findAll(filters?: {
    status?: string;
    streamerId?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): RecordingWithStreamer[] {
    let query = `
      SELECT r.*, s.username as streamer_username, s.display_name as streamer_display_name
      FROM recordings r
      JOIN streamers s ON r.streamer_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.status) {
      query += ' AND r.status = ?';
      params.push(filters.status);
    }

    if (filters?.streamerId) {
      query += ' AND r.streamer_id = ?';
      params.push(filters.streamerId);
    }

    if (filters?.search) {
      query += ' AND (r.stream_title LIKE ? OR s.username LIKE ? OR s.display_name LIKE ?)';
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY r.started_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as RecordingWithStreamer[];
  },

  // Find recording by ID
  findById(id: number): RecordingWithStreamer | undefined {
    const stmt = db.prepare(`
      SELECT r.*, s.username as streamer_username, s.display_name as streamer_display_name
      FROM recordings r
      JOIN streamers s ON r.streamer_id = s.id
      WHERE r.id = ?
    `);
    return stmt.get(id) as RecordingWithStreamer | undefined;
  },

  // Find active recording by streamer
  findActiveByStreamer(streamerId: number): Recording | undefined {
    const stmt = db.prepare(`
      SELECT * FROM recordings
      WHERE streamer_id = ? AND status = 'recording'
      ORDER BY started_at DESC
      LIMIT 1
    `);
    return stmt.get(streamerId) as Recording | undefined;
  },

  // Update recording
  update(id: number, input: UpdateRecordingInput): Recording | undefined {
    const sets: string[] = [];
    const values: any[] = [];

    if (input.stream_title !== undefined) {
      sets.push('stream_title = ?');
      values.push(input.stream_title);
    }
    if (input.stream_category !== undefined) {
      sets.push('stream_category = ?');
      values.push(input.stream_category);
    }
    if (input.file_size_bytes !== undefined) {
      sets.push('file_size_bytes = ?');
      values.push(input.file_size_bytes);
    }
    if (input.duration_seconds !== undefined) {
      sets.push('duration_seconds = ?');
      values.push(input.duration_seconds);
    }
    if (input.quality !== undefined) {
      sets.push('quality = ?');
      values.push(input.quality);
    }
    if (input.ended_at !== undefined) {
      sets.push('ended_at = ?');
      values.push(input.ended_at);
    }
    if (input.status !== undefined) {
      sets.push('status = ?');
      values.push(input.status);
    }
    if (input.error_message !== undefined) {
      sets.push('error_message = ?');
      values.push(input.error_message);
    }

    if (sets.length === 0) return this.findById(id);

    values.push(id);

    const stmt = db.prepare(`
      UPDATE recordings
      SET ${sets.join(', ')}
      WHERE id = ?
      RETURNING *
    `);

    return stmt.get(...values) as Recording | undefined;
  },

  // Delete recording
  delete(id: number): boolean {
    const stmt = db.prepare('DELETE FROM recordings WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  // Get active recordings count
  getActiveCount(): number {
    const stmt = db.prepare("SELECT COUNT(*) as count FROM recordings WHERE status = 'recording'");
    const result = stmt.get() as { count: number };
    return result.count;
  },

  // Get total downloaded bytes
  getTotalDownloaded(): number {
    const stmt = db.prepare(`
      SELECT SUM(file_size_bytes) as total FROM recordings WHERE status = 'completed'
    `);
    const result = stmt.get() as { total: number | null };
    return result.total || 0;
  },

  // Get recording stats
  getStats(): {
    total: number;
    recording: number;
    completed: number;
    error: number;
    stopped: number;
  } {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'recording' THEN 1 ELSE 0 END) as recording,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
        SUM(CASE WHEN status = 'stopped' THEN 1 ELSE 0 END) as stopped
      FROM recordings
    `);
    return stmt.get() as any;
  },
};
