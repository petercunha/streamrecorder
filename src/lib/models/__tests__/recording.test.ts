import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { clearTestDb, getTestDb } from '../../../../tests/db-mock';
import { RecordingModel } from '../recording';
import { StreamerModel } from '../streamer';

describe('RecordingModel', () => {
  let streamerId: number;

  beforeEach(() => {
    clearTestDb();
    
    // Create a test streamer
    const streamer = StreamerModel.create({ username: 'testuser' });
    streamerId = streamer.id;
  });

  afterAll(() => {
    const db = getTestDb();
    db.close();
  });

  describe('create', () => {
    it('should create a recording with required fields', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      expect(recording).toBeDefined();
      expect(recording.streamer_id).toBe(streamerId);
      expect(recording.file_path).toBe('recordings/test.mp4');
      expect(recording.status).toBe('recording');
      expect(recording.file_size_bytes).toBe(0);
      expect(recording.duration_seconds).toBe(0);
      expect(recording.id).toBeDefined();
      expect(recording.started_at).toBeDefined();
    });

    it('should accept optional fields', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
        stream_title: 'Test Stream',
        stream_category: 'Just Chatting',
        quality: '1080p60',
      });

      expect(recording.stream_title).toBe('Test Stream');
      expect(recording.stream_category).toBe('Just Chatting');
      expect(recording.quality).toBe('1080p60');
    });

    it('should store null for optional fields not provided', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      expect(recording.stream_title).toBeNull();
      expect(recording.stream_category).toBeNull();
      expect(recording.quality).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return empty array when no recordings exist', () => {
      const recordings = RecordingModel.findAll();
      expect(recordings).toEqual([]);
    });

    it('should return all recordings with streamer info', () => {
      RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test1.mp4',
      });

      const recordings = RecordingModel.findAll();
      expect(recordings).toHaveLength(1);
      expect(recordings[0].streamer_username).toBe('testuser');
      expect(recordings[0].streamer_display_name).toBe('testuser');
    });

    it('should filter by status', () => {
      const recording1 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test1.mp4',
      });
      const recording2 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test2.mp4',
      });

      RecordingModel.update(recording2.id, { status: 'completed' });

      const activeRecordings = RecordingModel.findAll({ status: 'recording' });
      const completedRecordings = RecordingModel.findAll({ status: 'completed' });

      expect(activeRecordings).toHaveLength(1);
      expect(completedRecordings).toHaveLength(1);
    });

    it('should filter by streamerId', () => {
      const streamer2 = StreamerModel.create({ username: 'user2' });

      RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test1.mp4',
      });
      RecordingModel.create({
        streamer_id: streamer2.id,
        file_path: 'recordings/test2.mp4',
      });

      const recordings = RecordingModel.findAll({ streamerId });
      expect(recordings).toHaveLength(1);
      expect(recordings[0].streamer_username).toBe('testuser');
    });

    it('should filter by search term', () => {
      RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test1.mp4',
        stream_title: 'Gaming Stream',
      });
      RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test2.mp4',
        stream_title: 'Chatting Stream',
      });

      const recordings = RecordingModel.findAll({ search: 'Gaming' });
      expect(recordings).toHaveLength(1);
      expect(recordings[0].stream_title).toBe('Gaming Stream');
    });

    it('should search in username', () => {
      RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      const recordings = RecordingModel.findAll({ search: 'test' });
      expect(recordings).toHaveLength(1);
    });

    it('should apply limit', () => {
      for (let i = 0; i < 5; i++) {
        RecordingModel.create({
          streamer_id: streamerId,
          file_path: `recordings/test${i}.mp4`,
        });
      }

      const recordings = RecordingModel.findAll({ limit: 3 });
      expect(recordings).toHaveLength(3);
    });

    it('should apply offset', () => {
      for (let i = 0; i < 5; i++) {
        RecordingModel.create({
          streamer_id: streamerId,
          file_path: `recordings/test${i}.mp4`,
        });
      }

      const recordings = RecordingModel.findAll({ limit: 2, offset: 2 });
      expect(recordings).toHaveLength(2);
    });

    it('should order by started_at DESC', async () => {
      const recording1 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test1.mp4',
      });
      
      // Wait for timestamp to differ (SQLite has second precision)
      await new Promise(r => setTimeout(r, 1100));
      
      const recording2 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test2.mp4',
      });

      const recordings = RecordingModel.findAll();
      expect(recordings[0].id).toBe(recording2.id);
      expect(recordings[1].id).toBe(recording1.id);
    });

    it('should combine multiple filters', () => {
      RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test1.mp4',
        stream_title: 'Gaming',
      });
      const recording2 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test2.mp4',
        stream_title: 'Chatting',
      });

      RecordingModel.update(recording2.id, { status: 'completed' });

      const recordings = RecordingModel.findAll({
        status: 'completed',
        search: 'Chat',
      });

      expect(recordings).toHaveLength(1);
      expect(recordings[0].stream_title).toBe('Chatting');
    });
  });

  describe('findById', () => {
    it('should return recording with streamer info by id', () => {
      const created = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      const found = RecordingModel.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.streamer_username).toBe('testuser');
    });

    it('should return undefined for non-existent id', () => {
      const found = RecordingModel.findById(999999);
      expect(found).toBeUndefined();
    });
  });

  describe('findActiveByStreamer', () => {
    it('should return active recording for streamer', () => {
      const created = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      const found = RecordingModel.findActiveByStreamer(streamerId);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined when no active recording', () => {
      const found = RecordingModel.findActiveByStreamer(streamerId);
      expect(found).toBeUndefined();
    });

    it('should return undefined when recording is completed', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      RecordingModel.update(recording.id, { status: 'completed' });

      const found = RecordingModel.findActiveByStreamer(streamerId);
      expect(found).toBeUndefined();
    });

    it('should return most recent active recording', () => {
      const old = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/old.mp4',
      });

      RecordingModel.update(old.id, { status: 'completed' });

      const recent = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/recent.mp4',
      });

      const found = RecordingModel.findActiveByStreamer(streamerId);
      expect(found?.id).toBe(recent.id);
    });
  });

  describe('update', () => {
    it('should update stream_title', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      const updated = RecordingModel.update(recording.id, {
        stream_title: 'New Title',
      });

      expect(updated?.stream_title).toBe('New Title');
    });

    it('should update stream_category', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      const updated = RecordingModel.update(recording.id, {
        stream_category: 'New Category',
      });

      expect(updated?.stream_category).toBe('New Category');
    });

    it('should update file_size_bytes', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      const updated = RecordingModel.update(recording.id, {
        file_size_bytes: 1024 * 1024,
      });

      expect(updated?.file_size_bytes).toBe(1024 * 1024);
    });

    it('should update duration_seconds', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      const updated = RecordingModel.update(recording.id, {
        duration_seconds: 3600,
      });

      expect(updated?.duration_seconds).toBe(3600);
    });

    it('should update quality', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      const updated = RecordingModel.update(recording.id, {
        quality: '720p',
      });

      expect(updated?.quality).toBe('720p');
    });

    it('should update status', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      const updated = RecordingModel.update(recording.id, {
        status: 'completed',
      });

      expect(updated?.status).toBe('completed');
    });

    it('should update ended_at', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      const endedAt = new Date().toISOString();
      const updated = RecordingModel.update(recording.id, {
        ended_at: endedAt,
      });

      expect(updated?.ended_at).toBe(endedAt);
    });

    it('should update error_message', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      const updated = RecordingModel.update(recording.id, {
        error_message: 'Something went wrong',
      });

      expect(updated?.error_message).toBe('Something went wrong');
    });

    it('should update multiple fields at once', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      const updated = RecordingModel.update(recording.id, {
        status: 'completed',
        duration_seconds: 3600,
        file_size_bytes: 1024 * 1024 * 100,
      });

      expect(updated?.status).toBe('completed');
      expect(updated?.duration_seconds).toBe(3600);
      expect(updated?.file_size_bytes).toBe(1024 * 1024 * 100);
    });

    it('should return undefined for non-existent id', () => {
      const updated = RecordingModel.update(999999, { status: 'completed' });
      expect(updated).toBeUndefined();
    });

    it('should return original recording when no fields provided', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      const updated = RecordingModel.update(recording.id, {});

      expect(updated?.id).toBe(recording.id);
      expect(updated?.file_path).toBe(recording.file_path);
    });
  });

  describe('delete', () => {
    it('should delete recording and return true', () => {
      const recording = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      const deleted = RecordingModel.delete(recording.id);

      expect(deleted).toBe(true);
      expect(RecordingModel.findById(recording.id)).toBeUndefined();
    });

    it('should return false for non-existent id', () => {
      const deleted = RecordingModel.delete(999999);
      expect(deleted).toBe(false);
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 when no active recordings', () => {
      expect(RecordingModel.getActiveCount()).toBe(0);
    });

    it('should return count of recording status', () => {
      RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test1.mp4',
      });
      RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test2.mp4',
      });

      expect(RecordingModel.getActiveCount()).toBe(2);
    });

    it('should not count completed or stopped recordings', () => {
      const recording1 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test1.mp4',
      });
      const recording2 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test2.mp4',
      });

      RecordingModel.update(recording1.id, { status: 'completed' });
      RecordingModel.update(recording2.id, { status: 'error' });

      expect(RecordingModel.getActiveCount()).toBe(0);
    });
  });

  describe('getTotalDownloaded', () => {
    it('should return 0 when no recordings', () => {
      expect(RecordingModel.getTotalDownloaded()).toBe(0);
    });

    it('should return sum of file sizes', () => {
      const recording1 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test1.mp4',
      });
      const recording2 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test2.mp4',
      });

      RecordingModel.update(recording1.id, { file_size_bytes: 1000 });
      RecordingModel.update(recording2.id, { file_size_bytes: 2000 });

      expect(RecordingModel.getTotalDownloaded()).toBe(3000);
    });

    it('should handle null values', () => {
      RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test.mp4',
      });

      expect(RecordingModel.getTotalDownloaded()).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return zero stats when no recordings', () => {
      const stats = RecordingModel.getStats();

      // SQLite returns null/0 for empty aggregations
      expect(stats.total || 0).toBe(0);
      expect(stats.recording || 0).toBe(0);
      expect(stats.completed || 0).toBe(0);
      expect(stats.error || 0).toBe(0);
      expect(stats.stopped || 0).toBe(0);
    });

    it('should return correct stats for mixed statuses', () => {
      const r1 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test1.mp4',
      });
      const r2 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test2.mp4',
      });
      const r3 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test3.mp4',
      });
      const r4 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test4.mp4',
      });

      RecordingModel.update(r1.id, { status: 'completed' });
      RecordingModel.update(r2.id, { status: 'error' });
      RecordingModel.update(r3.id, { status: 'stopped' });
      // r4 stays as 'recording'

      const stats = RecordingModel.getStats();

      expect(stats.total).toBe(4);
      expect(stats.recording).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.error).toBe(1);
      expect(stats.stopped).toBe(1);
    });
  });
});
