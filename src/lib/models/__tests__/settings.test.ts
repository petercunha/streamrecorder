import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { clearTestDb, getTestDb } from '../../../../tests/db-mock';
import { SettingsModel } from '../settings';

describe('SettingsModel', () => {
  beforeAll(() => {
    getTestDb();
  });

  beforeEach(() => {
    clearTestDb();
    // Reset settings to defaults
    const db = getTestDb();
    db.prepare('DELETE FROM settings WHERE id = 1').run();
    db.prepare('INSERT INTO settings (id) VALUES (1)').run();
  });

  afterAll(() => {
    const db = getTestDb();
    db.close();
  });

  describe('get', () => {
    it('should return default settings', () => {
      const settings = SettingsModel.get();

      expect(settings.id).toBe(1);
      expect(settings.min_free_disk_mb).toBe(5000);
      expect(settings.max_recording_size_mb).toBe(0);
      expect(settings.max_total_recordings_mb).toBe(0);
      expect(settings.max_recording_duration_hours).toBe(0);
      expect(settings.check_interval_seconds).toBe(60);
    });
  });

  describe('update', () => {
    it('should update min_free_disk_mb', () => {
      const updated = SettingsModel.update({ min_free_disk_mb: 10000 });

      expect(updated).toBeDefined();
      expect(updated?.min_free_disk_mb).toBe(10000);
    });

    it('should update max_recording_size_mb', () => {
      const updated = SettingsModel.update({ max_recording_size_mb: 5000 });

      expect(updated).toBeDefined();
      expect(updated?.max_recording_size_mb).toBe(5000);
    });

    it('should update max_total_recordings_mb', () => {
      const updated = SettingsModel.update({ max_total_recordings_mb: 50000 });

      expect(updated).toBeDefined();
      expect(updated?.max_total_recordings_mb).toBe(50000);
    });

    it('should update max_recording_duration_hours', () => {
      const updated = SettingsModel.update({ max_recording_duration_hours: 4 });

      expect(updated).toBeDefined();
      expect(updated?.max_recording_duration_hours).toBe(4);
    });

    it('should update check_interval_seconds', () => {
      const updated = SettingsModel.update({ check_interval_seconds: 120 });

      expect(updated).toBeDefined();
      expect(updated?.check_interval_seconds).toBe(120);
    });

    it('should update multiple fields at once', () => {
      const updated = SettingsModel.update({
        min_free_disk_mb: 8000,
        max_recording_size_mb: 10000,
        max_recording_duration_hours: 2,
      });

      expect(updated).toBeDefined();
      expect(updated?.min_free_disk_mb).toBe(8000);
      expect(updated?.max_recording_size_mb).toBe(10000);
      expect(updated?.max_recording_duration_hours).toBe(2);
      // Unchanged fields should retain default values
      expect(updated?.max_total_recordings_mb).toBe(0);
      expect(updated?.check_interval_seconds).toBe(60);
    });

    it('should return current settings when no updates provided', () => {
      const settings = SettingsModel.update({});

      expect(settings).toBeDefined();
      expect(settings?.min_free_disk_mb).toBe(5000);
    });

    it('should update updated_at timestamp', async () => {
      const before = SettingsModel.get();
      
      // Wait a bit to ensure timestamp changes (SQLite has second precision)
      await new Promise(r => setTimeout(r, 1100));
      
      const updated = SettingsModel.update({ min_free_disk_mb: 10000 });

      expect(updated).toBeDefined();
      expect(updated?.updated_at).not.toBe(before.updated_at);
    });
  });

  describe('getDiskLimits', () => {
    it('should return disk limits in the expected format', () => {
      SettingsModel.update({
        min_free_disk_mb: 10000,
        max_recording_size_mb: 5000,
        max_total_recordings_mb: 50000,
        max_recording_duration_hours: 3,
      });

      const limits = SettingsModel.getDiskLimits();

      expect(limits).toEqual({
        minFreeMb: 10000,
        maxRecordingMb: 5000,
        maxTotalRecordingsMb: 50000,
        maxRecordingDurationHours: 3,
      });
    });

    it('should return default values', () => {
      const limits = SettingsModel.getDiskLimits();

      expect(limits).toEqual({
        minFreeMb: 5000,
        maxRecordingMb: 0,
        maxTotalRecordingsMb: 0,
        maxRecordingDurationHours: 0,
      });
    });
  });
});
