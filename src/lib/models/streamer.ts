import db from '../db';

export interface Streamer {
  id: number;
  username: string;
  display_name: string | null;
  is_active: boolean;
  auto_record: boolean;
  quality_preference: string;
  created_at: string;
  updated_at: string;
}

export interface CreateStreamerInput {
  username: string;
  display_name?: string;
  auto_record?: boolean;
  quality_preference?: string;
}

export interface UpdateStreamerInput {
  display_name?: string;
  is_active?: boolean;
  auto_record?: boolean;
  quality_preference?: string;
}

export const StreamerModel = {
  // Create a new streamer
  create(input: CreateStreamerInput): Streamer {
    const stmt = db.prepare(`
      INSERT INTO streamers (username, display_name, auto_record, quality_preference)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);

    const result = stmt.get(
      input.username.toLowerCase(),
      input.display_name || input.username,
      (input.auto_record ?? true) ? 1 : 0,
      input.quality_preference || 'best'
    ) as Streamer;

    return result;
  },

  // Find all streamers
  findAll(includeInactive = false): Streamer[] {
    const stmt = db.prepare(`
      SELECT * FROM streamers
      ${includeInactive ? '' : 'WHERE is_active = 1'}
      ORDER BY username ASC
    `);
    return stmt.all() as Streamer[];
  },

  // Find streamer by ID
  findById(id: number): Streamer | undefined {
    const stmt = db.prepare('SELECT * FROM streamers WHERE id = ?');
    return stmt.get(id) as Streamer | undefined;
  },

  // Find streamer by username
  findByUsername(username: string): Streamer | undefined {
    const stmt = db.prepare('SELECT * FROM streamers WHERE username = ?');
    return stmt.get(username.toLowerCase()) as Streamer | undefined;
  },

  // Update streamer
  update(id: number, input: UpdateStreamerInput): Streamer | undefined {
    const sets: string[] = [];
    const values: any[] = [];

    if (input.display_name !== undefined) {
      sets.push('display_name = ?');
      values.push(input.display_name);
    }
    if (input.is_active !== undefined) {
      sets.push('is_active = ?');
      values.push(input.is_active ? 1 : 0);
    }
    if (input.auto_record !== undefined) {
      sets.push('auto_record = ?');
      values.push(input.auto_record ? 1 : 0);
    }
    if (input.quality_preference !== undefined) {
      sets.push('quality_preference = ?');
      values.push(input.quality_preference);
    }

    if (sets.length === 0) return this.findById(id);

    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`
      UPDATE streamers
      SET ${sets.join(', ')}
      WHERE id = ?
      RETURNING *
    `);

    return stmt.get(...values) as Streamer | undefined;
  },

  // Delete streamer
  delete(id: number): boolean {
    const stmt = db.prepare('DELETE FROM streamers WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  // Count streamers
  count(): number {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM streamers WHERE is_active = 1');
    const result = stmt.get() as { count: number };
    return result.count;
  },
};
