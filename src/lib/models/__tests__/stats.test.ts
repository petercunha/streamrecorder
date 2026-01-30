import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { clearTestDb, getTestDb } from '../../../../tests/db-mock';
import { StatsModel } from '../stats';
import { StreamerModel } from '../streamer';
import { RecordingModel } from '../recording';

describe('StatsModel', () => {
  beforeEach(() => {
    clearTestDb();
  });

  afterAll(() => {
    const db = getTestDb();
    db.close();
  });

  describe('get', () => {
    it('should return stats with id = 1', () => {
      const stats = StatsModel.get();
      expect(stats.id).toBe(1);
    });

    it('should return default values', () => {
      const stats = StatsModel.get();
      expect(stats.total_downloaded_bytes).toBe(0);
      expect(stats.total_recordings).toBe(0);
      expect(stats.total_streamers).toBe(0);
      expect(stats.active_recordings).toBe(0);
    });

    it('should return updated_at timestamp', () => {
      const stats = StatsModel.get();
      expect(stats.updated_at).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update total_downloaded_bytes', () => {
      StatsModel.update({ total_downloaded_bytes: 1024 * 1024 });
      const stats = StatsModel.get();
      expect(stats.total_downloaded_bytes).toBe(1024 * 1024);
    });

    it('should update total_recordings', () => {
      StatsModel.update({ total_recordings: 5 });
      const stats = StatsModel.get();
      expect(stats.total_recordings).toBe(5);
    });

    it('should update total_streamers', () => {
      StatsModel.update({ total_streamers: 3 });
      const stats = StatsModel.get();
      expect(stats.total_streamers).toBe(3);
    });

    it('should update active_recordings', () => {
      StatsModel.update({ active_recordings: 2 });
      const stats = StatsModel.get();
      expect(stats.active_recordings).toBe(2);
    });

    it('should update multiple fields at once', () => {
      StatsModel.update({
        total_recordings: 10,
        total_streamers: 5,
        active_recordings: 2,
      });

      const stats = StatsModel.get();
      expect(stats.total_recordings).toBe(10);
      expect(stats.total_streamers).toBe(5);
      expect(stats.active_recordings).toBe(2);
    });

    it('should not modify unprovided fields', () => {
      StatsModel.update({ total_recordings: 5 });
      StatsModel.update({ total_streamers: 3 });

      const stats = StatsModel.get();
      expect(stats.total_recordings).toBe(5);
      expect(stats.total_streamers).toBe(3);
    });

    it('should update updated_at timestamp', async () => {
      const before = StatsModel.get().updated_at;
      
      // Wait a bit to ensure timestamp changes (SQLite has second precision)
      await new Promise(r => setTimeout(r, 1100));
      
      StatsModel.update({ total_recordings: 1 });
      const after = StatsModel.get().updated_at;

      expect(after).not.toBe(before);
    });

    it('should do nothing when no fields provided', () => {
      const before = StatsModel.get();
      StatsModel.update({});
      const after = StatsModel.get();

      expect(after).toEqual(before);
    });
  });

  describe('recalculate', () => {
    it('should recalculate streamer count', () => {
      StreamerModel.create({ username: 'user1' });
      StreamerModel.create({ username: 'user2' });

      StatsModel.recalculate();
      const stats = StatsModel.get();

      expect(stats.total_streamers).toBe(2);
    });

    it('should recalculate recording counts', () => {
      const streamer = StreamerModel.create({ username: 'user1' });
      RecordingModel.create({ streamer_id: streamer.id, file_path: 'test1.mp4' });
      RecordingModel.create({ streamer_id: streamer.id, file_path: 'test2.mp4' });

      StatsModel.recalculate();
      const stats = StatsModel.get();

      expect(stats.total_recordings).toBe(2);
    });

    it('should recalculate active recordings count', () => {
      const streamer = StreamerModel.create({ username: 'user1' });
      const r1 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test1.mp4' });
      const r2 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test2.mp4' });
      
      RecordingModel.update(r1.id, { status: 'completed' });

      StatsModel.recalculate();
      const stats = StatsModel.get();

      expect(stats.active_recordings).toBe(1);
    });

    it('should recalculate total downloaded bytes', () => {
      const streamer = StreamerModel.create({ username: 'user1' });
      const r1 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test1.mp4' });
      const r2 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test2.mp4' });

      RecordingModel.update(r1.id, { file_size_bytes: 1024 * 1024 });
      RecordingModel.update(r2.id, { file_size_bytes: 2 * 1024 * 1024 });

      StatsModel.recalculate();
      const stats = StatsModel.get();

      expect(stats.total_downloaded_bytes).toBe(3 * 1024 * 1024);
    });

    it('should not count inactive streamers', () => {
      const streamer = StreamerModel.create({ username: 'user1' });
      StreamerModel.create({ username: 'user2' });
      StreamerModel.update(streamer.id, { is_active: false });

      StatsModel.recalculate();
      const stats = StatsModel.get();

      expect(stats.total_streamers).toBe(1);
    });
  });

  describe('getSystemStats', () => {
    it('should return formatted totalDownloaded', () => {
      const streamer = StreamerModel.create({ username: 'user1' });
      const recording = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test.mp4' });
      RecordingModel.update(recording.id, { file_size_bytes: 1024 * 1024 * 2.5 });

      const stats = StatsModel.getSystemStats();

      expect(stats.totalDownloaded).toBe('2.5 MB');
    });

    it('should return 0 B for zero bytes', () => {
      const stats = StatsModel.getSystemStats();
      expect(stats.totalDownloaded).toBe('0 B');
    });

    it('should format bytes correctly', () => {
      const streamer = StreamerModel.create({ username: 'user1' });
      
      // Test bytes
      let recording = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test.mp4' });
      RecordingModel.update(recording.id, { file_size_bytes: 500 });
      let stats = StatsModel.getSystemStats();
      expect(stats.totalDownloaded).toBe('500 B');

      // Clear and test KB
      const db = getTestDb();
      db.exec('DELETE FROM recordings');
      recording = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test.mp4' });
      RecordingModel.update(recording.id, { file_size_bytes: 1024 * 2.5 });
      stats = StatsModel.getSystemStats();
      expect(stats.totalDownloaded).toBe('2.5 KB');

      // Clear and test GB
      db.exec('DELETE FROM recordings');
      recording = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test.mp4' });
      RecordingModel.update(recording.id, { file_size_bytes: 1024 * 1024 * 1024 * 1.5 });
      stats = StatsModel.getSystemStats();
      expect(stats.totalDownloaded).toBe('1.5 GB');
    });

    it('should return correct recording stats', () => {
      const streamer = StreamerModel.create({ username: 'user1' });
      
      const r1 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test1.mp4' });
      const r2 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test2.mp4' });
      const r3 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test3.mp4' });
      const r4 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test4.mp4' });

      RecordingModel.update(r1.id, { status: 'completed' });
      RecordingModel.update(r2.id, { status: 'error' });
      RecordingModel.update(r3.id, { status: 'stopped' });
      // r4 stays as 'recording'

      const stats = StatsModel.getSystemStats();

      expect(stats.recordingStats).toEqual({
        total: 4,
        recording: 1,
        completed: 1,
        error: 1,
        stopped: 1,
      });
    });

    it('should return activeRecordings from database', () => {
      const streamer = StreamerModel.create({ username: 'user1' });
      RecordingModel.create({ streamer_id: streamer.id, file_path: 'test1.mp4' });
      RecordingModel.create({ streamer_id: streamer.id, file_path: 'test2.mp4' });

      const stats = StatsModel.getSystemStats();
      expect(stats.activeRecordings).toBe(2);
    });

    it('should return totalRecordings from database', () => {
      const streamer = StreamerModel.create({ username: 'user1' });
      RecordingModel.create({ streamer_id: streamer.id, file_path: 'test1.mp4' });
      RecordingModel.create({ streamer_id: streamer.id, file_path: 'test2.mp4' });

      const stats = StatsModel.getSystemStats();
      expect(stats.totalRecordings).toBe(2);
    });

    it('should return totalStreamers from database', () => {
      StreamerModel.create({ username: 'user1' });
      StreamerModel.create({ username: 'user2' });
      StreamerModel.create({ username: 'user3' });

      const stats = StatsModel.getSystemStats();
      expect(stats.totalStreamers).toBe(3);
    });

    it('should recalculate before returning', () => {
      const streamer = StreamerModel.create({ username: 'user1' });
      RecordingModel.create({ streamer_id: streamer.id, file_path: 'test.mp4' });

      // Stats should be recalculated automatically
      const stats = StatsModel.getSystemStats();
      expect(stats.totalRecordings).toBe(1);
      expect(stats.totalStreamers).toBe(1);
    });
  });
});
