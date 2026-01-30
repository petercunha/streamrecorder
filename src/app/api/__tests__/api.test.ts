import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import { clearTestDb, getTestDb } from '../../../../tests/db-mock';
import { StreamerModel } from '@/lib/models/streamer';
import { RecordingModel } from '@/lib/models/recording';
import { RecordingLogModel } from '@/lib/models/recording-log';

describe('API Routes Logic', () => {
  beforeAll(() => {
    // Initialize database
    getTestDb();
  });

  beforeEach(() => {
    clearTestDb();
  });

  afterAll(() => {
    const db = getTestDb();
    db.close();
  });

  describe('Streamer API Logic', () => {
    it('should create and retrieve streamers', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      
      expect(streamer).toBeDefined();
      expect(streamer.username).toBe('testuser');
      
      const found = StreamerModel.findById(streamer.id);
      expect(found?.username).toBe('testuser');
    });

    it('should handle username normalization', () => {
      const streamer = StreamerModel.create({ username: 'TestUser123' });
      
      expect(streamer.username).toBe('testuser123');
      
      // Should be findable with any case
      const found = StreamerModel.findByUsername('TESTUSER123');
      expect(found).toBeDefined();
    });

    it('should reject duplicate usernames', () => {
      StreamerModel.create({ username: 'testuser' });
      
      expect(() => {
        StreamerModel.create({ username: 'testuser' });
      }).toThrow();
    });

    it('should support soft delete via is_active flag', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      
      // By default, only active streamers are returned
      expect(StreamerModel.findAll()).toHaveLength(1);
      
      // Deactivate
      StreamerModel.update(streamer.id, { is_active: false });
      
      // Not in default list
      expect(StreamerModel.findAll()).toHaveLength(0);
      
      // But in full list
      expect(StreamerModel.findAll(true)).toHaveLength(1);
    });

    it('should support partial updates', () => {
      const streamer = StreamerModel.create({
        username: 'testuser',
        display_name: 'Original Name',
        quality_preference: '720p',
      });
      
      // Update only display_name
      const updated = StreamerModel.update(streamer.id, {
        display_name: 'New Name',
      });
      
      expect(updated?.display_name).toBe('New Name');
      expect(updated?.quality_preference).toBe('720p'); // unchanged
    });
  });

  describe('Recording API Logic', () => {
    it('should create recordings with streamer info', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      const recording = RecordingModel.create({
        streamer_id: streamer.id,
        file_path: 'recordings/test.mp4',
        stream_title: 'Test Stream',
        stream_category: 'Gaming',
      });
      
      const found = RecordingModel.findById(recording.id);
      expect(found?.streamer_username).toBe('testuser');
      expect(found?.stream_title).toBe('Test Stream');
      expect(found?.stream_category).toBe('Gaming');
    });

    it('should support filtering by status', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      
      const r1 = RecordingModel.create({
        streamer_id: streamer.id,
        file_path: 'test1.mp4',
      });
      const r2 = RecordingModel.create({
        streamer_id: streamer.id,
        file_path: 'test2.mp4',
      });
      
      RecordingModel.update(r2.id, { status: 'completed' });
      
      expect(RecordingModel.findAll({ status: 'recording' })).toHaveLength(1);
      expect(RecordingModel.findAll({ status: 'completed' })).toHaveLength(1);
    });

    it('should support filtering by streamerId', () => {
      const streamer1 = StreamerModel.create({ username: 'user1' });
      const streamer2 = StreamerModel.create({ username: 'user2' });
      
      RecordingModel.create({ streamer_id: streamer1.id, file_path: 'test1.mp4' });
      RecordingModel.create({ streamer_id: streamer2.id, file_path: 'test2.mp4' });
      
      const recordings = RecordingModel.findAll({ streamerId: streamer1.id });
      expect(recordings).toHaveLength(1);
      expect(recordings[0].streamer_username).toBe('user1');
    });

    it('should support search filtering', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      
      RecordingModel.create({
        streamer_id: streamer.id,
        file_path: 'test1.mp4',
        stream_title: 'Gaming Stream',
      });
      RecordingModel.create({
        streamer_id: streamer.id,
        file_path: 'test2.mp4',
        stream_title: 'Chatting Stream',
      });
      
      const results = RecordingModel.findAll({ search: 'Gaming' });
      expect(results).toHaveLength(1);
      expect(results[0].stream_title).toBe('Gaming Stream');
    });

    it('should support pagination', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      
      for (let i = 0; i < 10; i++) {
        RecordingModel.create({
          streamer_id: streamer.id,
          file_path: `test${i}.mp4`,
        });
      }
      
      const page1 = RecordingModel.findAll({ limit: 3, offset: 0 });
      const page2 = RecordingModel.findAll({ limit: 3, offset: 3 });
      
      expect(page1).toHaveLength(3);
      expect(page2).toHaveLength(3);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it('should track active recordings', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      
      RecordingModel.create({ streamer_id: streamer.id, file_path: 'test1.mp4' });
      RecordingModel.create({ streamer_id: streamer.id, file_path: 'test2.mp4' });
      
      expect(RecordingModel.getActiveCount()).toBe(2);
    });
  });

  describe('Stats API Logic', () => {
    it('should calculate total downloaded', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      
      const r1 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test1.mp4' });
      const r2 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test2.mp4' });
      
      RecordingModel.update(r1.id, { file_size_bytes: 1024 * 1024 });
      RecordingModel.update(r2.id, { file_size_bytes: 2 * 1024 * 1024 });
      
      expect(RecordingModel.getTotalDownloaded()).toBe(3 * 1024 * 1024);
    });

    it('should calculate recording stats', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      
      const r1 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test1.mp4' });
      const r2 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test2.mp4' });
      const r3 = RecordingModel.create({ streamer_id: streamer.id, file_path: 'test3.mp4' });
      
      RecordingModel.update(r1.id, { status: 'completed' });
      RecordingModel.update(r2.id, { status: 'error' });
      // r3 stays as 'recording'
      
      const stats = RecordingModel.getStats();
      expect(stats.total).toBe(3);
      expect(stats.recording).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.error).toBe(1);
    });
  });

  describe('Logs API Logic', () => {
    it('should create and retrieve logs', () => {
      const log = RecordingLogModel.create({
        message: 'Test log message',
        level: 'info',
      });
      
      expect(log.message).toBe('Test log message');
      expect(log.level).toBe('info');
      
      const logs = RecordingLogModel.findAll();
      expect(logs).toHaveLength(1);
    });

    it('should support log levels', () => {
      RecordingLogModel.create({ message: 'Info', level: 'info' });
      RecordingLogModel.create({ message: 'Warn', level: 'warn' });
      RecordingLogModel.create({ message: 'Error', level: 'error' });
      RecordingLogModel.create({ message: 'Success', level: 'success' });
      
      expect(RecordingLogModel.findAll({ level: 'error' })).toHaveLength(1);
      expect(RecordingLogModel.findAll({ level: 'info' })).toHaveLength(1);
    });

    it('should support filtering by recording_id', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      const recording = RecordingModel.create({
        streamer_id: streamer.id,
        file_path: 'test.mp4',
      });
      
      RecordingLogModel.create({
        message: 'For recording',
        recording_id: recording.id,
      });
      RecordingLogModel.create({
        message: 'General log',
      });
      
      const logs = RecordingLogModel.findAll({ recordingId: recording.id });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('For recording');
    });

    it('should return recent logs with limit', () => {
      for (let i = 0; i < 60; i++) {
        RecordingLogModel.create({ message: `Log ${i}` });
      }
      
      const recent = RecordingLogModel.getRecent();
      expect(recent).toHaveLength(50);
    });
  });
});
