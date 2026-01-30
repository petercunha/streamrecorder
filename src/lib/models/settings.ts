import db from '../db';

export interface Settings {
  id: number;
  min_free_disk_mb: number;
  max_recording_size_mb: number;
  max_total_recordings_mb: number;
  max_recording_duration_hours: number;
  check_interval_seconds: number;
  updated_at: string;
}

export interface UpdateSettingsInput {
  min_free_disk_mb?: number;
  max_recording_size_mb?: number;
  max_total_recordings_mb?: number;
  max_recording_duration_hours?: number;
  check_interval_seconds?: number;
}

export const SettingsModel = {
  // Get current settings
  get(): Settings {
    const stmt = db.prepare('SELECT * FROM settings WHERE id = 1');
    return stmt.get() as Settings;
  },

  // Update settings
  update(updates: UpdateSettingsInput): Settings | undefined {
    const sets: string[] = [];
    const values: any[] = [];

    if (updates.min_free_disk_mb !== undefined) {
      sets.push('min_free_disk_mb = ?');
      values.push(updates.min_free_disk_mb);
    }
    if (updates.max_recording_size_mb !== undefined) {
      sets.push('max_recording_size_mb = ?');
      values.push(updates.max_recording_size_mb);
    }
    if (updates.max_total_recordings_mb !== undefined) {
      sets.push('max_total_recordings_mb = ?');
      values.push(updates.max_total_recordings_mb);
    }
    if (updates.max_recording_duration_hours !== undefined) {
      sets.push('max_recording_duration_hours = ?');
      values.push(updates.max_recording_duration_hours);
    }
    if (updates.check_interval_seconds !== undefined) {
      sets.push('check_interval_seconds = ?');
      values.push(updates.check_interval_seconds);
    }

    if (sets.length === 0) return this.get();

    sets.push('updated_at = CURRENT_TIMESTAMP');

    const stmt = db.prepare(`
      UPDATE settings 
      SET ${sets.join(', ')} 
      WHERE id = 1 
      RETURNING *
    `);
    return stmt.get(...values) as Settings | undefined;
  },

  // Get disk limits in the format expected by disk-space utilities
  getDiskLimits(): {
    minFreeMb: number;
    maxRecordingMb: number;
    maxTotalRecordingsMb: number;
    maxRecordingDurationHours: number;
  } {
    const settings = this.get();
    return {
      minFreeMb: settings.min_free_disk_mb,
      maxRecordingMb: settings.max_recording_size_mb,
      maxTotalRecordingsMb: settings.max_total_recordings_mb,
      maxRecordingDurationHours: settings.max_recording_duration_hours,
    };
  },
};
