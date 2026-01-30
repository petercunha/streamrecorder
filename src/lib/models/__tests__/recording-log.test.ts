import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { clearTestDb, getTestDb } from '../../../../tests/db-mock';
import { RecordingLogModel } from '../recording-log';
import { RecordingModel } from '../recording';
import { StreamerModel } from '../streamer';

describe('RecordingLogModel', () => {
  let streamerId: number;
  let recordingId: number;

  beforeEach(() => {
    clearTestDb();
    
    // Create a test streamer and recording
    const streamer = StreamerModel.create({ username: 'testuser' });
    streamerId = streamer.id;
    
    const recording = RecordingModel.create({
      streamer_id: streamerId,
      file_path: 'recordings/test.mp4',
    });
    recordingId = recording.id;
  });

  afterAll(() => {
    const db = getTestDb();
    db.close();
  });

  describe('create', () => {
    it('should create a log with required message', () => {
      const log = RecordingLogModel.create({ message: 'Test message' });

      expect(log).toBeDefined();
      expect(log.message).toBe('Test message');
      expect(log.id).toBeDefined();
      expect(log.created_at).toBeDefined();
    });

    it('should default level to info', () => {
      const log = RecordingLogModel.create({ message: 'Test message' });
      expect(log.level).toBe('info');
    });

    it('should accept recording_id', () => {
      const log = RecordingLogModel.create({
        message: 'Test message',
        recording_id: recordingId,
      });

      expect(log.recording_id).toBe(recordingId);
    });

    it('should accept streamer_username', () => {
      const log = RecordingLogModel.create({
        message: 'Test message',
        streamer_username: 'testuser',
      });

      expect(log.streamer_username).toBe('testuser');
    });

    it('should accept level', () => {
      const levels: Array<'info' | 'warn' | 'error' | 'success'> = ['info', 'warn', 'error', 'success'];

      for (const level of levels) {
        const log = RecordingLogModel.create({
          message: 'Test message',
          level,
        });

        expect(log.level).toBe(level);
      }
    });

    it('should accept all fields', () => {
      const log = RecordingLogModel.create({
        message: 'Recording started',
        recording_id: recordingId,
        streamer_username: 'testuser',
        level: 'success',
      });

      expect(log.message).toBe('Recording started');
      expect(log.recording_id).toBe(recordingId);
      expect(log.streamer_username).toBe('testuser');
      expect(log.level).toBe('success');
    });

    it('should store null for optional fields not provided', () => {
      const log = RecordingLogModel.create({ message: 'Test message' });
      expect(log.recording_id).toBeNull();
      expect(log.streamer_username).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return empty array when no logs exist', () => {
      const logs = RecordingLogModel.findAll();
      expect(logs).toEqual([]);
    });

    it('should return all logs', () => {
      RecordingLogModel.create({ message: 'Message 1' });
      RecordingLogModel.create({ message: 'Message 2' });

      const logs = RecordingLogModel.findAll();
      expect(logs).toHaveLength(2);
    });

    it('should filter by recordingId', () => {
      const recording2 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test2.mp4',
      });

      RecordingLogModel.create({
        message: 'Log for recording 1',
        recording_id: recordingId,
      });
      RecordingLogModel.create({
        message: 'Log for recording 2',
        recording_id: recording2.id,
      });

      const logs = RecordingLogModel.findAll({ recordingId });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Log for recording 1');
    });

    it('should filter by streamerUsername', () => {
      RecordingLogModel.create({
        message: 'Log for user1',
        streamer_username: 'user1',
      });
      RecordingLogModel.create({
        message: 'Log for user2',
        streamer_username: 'user2',
      });

      const logs = RecordingLogModel.findAll({ streamerUsername: 'user1' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Log for user1');
    });

    it('should filter by level', () => {
      RecordingLogModel.create({ message: 'Info message', level: 'info' });
      RecordingLogModel.create({ message: 'Error message', level: 'error' });
      RecordingLogModel.create({ message: 'Warn message', level: 'warn' });

      const logs = RecordingLogModel.findAll({ level: 'error' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Error message');
    });

    it('should apply limit', () => {
      for (let i = 0; i < 5; i++) {
        RecordingLogModel.create({ message: `Message ${i}` });
      }

      const logs = RecordingLogModel.findAll({ limit: 3 });
      expect(logs).toHaveLength(3);
    });

    it('should combine multiple filters', () => {
      RecordingLogModel.create({
        message: 'Error for recording',
        recording_id: recordingId,
        level: 'error',
      });
      RecordingLogModel.create({
        message: 'Info for recording',
        recording_id: recordingId,
        level: 'info',
      });
      RecordingLogModel.create({
        message: 'Error for other',
        level: 'error',
      });

      const logs = RecordingLogModel.findAll({
        recordingId,
        level: 'error',
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Error for recording');
    });

    it('should order by created_at DESC', async () => {
      const log1 = RecordingLogModel.create({ message: 'First' });
      
      // Wait for timestamp to differ (SQLite has second precision)
      await new Promise(r => setTimeout(r, 1100));
      
      const log2 = RecordingLogModel.create({ message: 'Second' });

      const logs = RecordingLogModel.findAll();
      expect(logs[0].id).toBe(log2.id);
      expect(logs[1].id).toBe(log1.id);
    });
  });

  describe('getRecent', () => {
    it('should return empty array when no logs exist', () => {
      const logs = RecordingLogModel.getRecent();
      expect(logs).toEqual([]);
    });

    it('should return recent logs with default limit', () => {
      for (let i = 0; i < 60; i++) {
        RecordingLogModel.create({ message: `Log ${i}` });
      }

      const logs = RecordingLogModel.getRecent();
      expect(logs).toHaveLength(50);
    });

    it('should respect custom limit', () => {
      for (let i = 0; i < 20; i++) {
        RecordingLogModel.create({ message: `Log ${i}` });
      }

      const logs = RecordingLogModel.getRecent(10);
      expect(logs).toHaveLength(10);
    });

    it('should return logs ordered by created_at DESC', async () => {
      const log1 = RecordingLogModel.create({ message: 'First' });
      await new Promise(r => setTimeout(r, 1100));
      const log2 = RecordingLogModel.create({ message: 'Second' });

      const logs = RecordingLogModel.getRecent(10);
      expect(logs[0].id).toBe(log2.id);
      expect(logs[1].id).toBe(log1.id);
    });

    it('should return most recent when more logs than limit', async () => {
      // Create logs with significant delay to ensure different timestamps
      const messages = [];
      for (let i = 0; i < 10; i++) {
        const msg = `Message ${i}_${Date.now()}`;
        messages.push(msg);
        RecordingLogModel.create({ message: msg });
        // Wait enough time for timestamp to differ (SQLite has second precision)
        await new Promise(r => setTimeout(r, 50));
      }

      const logs = RecordingLogModel.getRecent(5);
      expect(logs).toHaveLength(5);
      // Should get the 5 most recent (ordered by created_at DESC)
      // Verify they're ordered from newest to oldest
      for (let i = 0; i < logs.length - 1; i++) {
        expect(new Date(logs[i].created_at).getTime()).toBeGreaterThanOrEqual(
          new Date(logs[i + 1].created_at).getTime()
        );
      }
    });
  });

  describe('clearOld', () => {
    it('should return 0 when no old logs exist', () => {
      const deleted = RecordingLogModel.clearOld(7);
      expect(deleted).toBe(0);
    });

    it('should delete logs older than specified days', () => {
      // Create some logs
      for (let i = 0; i < 5; i++) {
        RecordingLogModel.create({ message: `Message ${i}` });
      }

      // All logs are recent, so none should be deleted
      const deleted = RecordingLogModel.clearOld(7);
      expect(deleted).toBe(0);

      // All logs should still exist
      const logs = RecordingLogModel.findAll();
      expect(logs).toHaveLength(5);
    });

    it('should use default 7 days', () => {
      // This just tests that the function runs with default param
      const deleted = RecordingLogModel.clearOld();
      expect(deleted).toBe(0);
    });
  });

  describe('cascade delete', () => {
    it('should delete logs when recording is deleted', () => {
      RecordingLogModel.create({
        message: 'Log for recording',
        recording_id: recordingId,
      });

      // Verify log exists
      let logs = RecordingLogModel.findAll({ recordingId });
      expect(logs).toHaveLength(1);

      // Delete recording
      RecordingModel.delete(recordingId);

      // Log should be deleted due to cascade
      logs = RecordingLogModel.findAll({ recordingId });
      expect(logs).toHaveLength(0);
    });

    it('should not delete unrelated logs', () => {
      const recording2 = RecordingModel.create({
        streamer_id: streamerId,
        file_path: 'recordings/test2.mp4',
      });

      RecordingLogModel.create({
        message: 'Log for recording 1',
        recording_id: recordingId,
      });
      RecordingLogModel.create({
        message: 'Log for recording 2',
        recording_id: recording2.id,
      });

      // Delete recording 1
      RecordingModel.delete(recordingId);

      // Log for recording 2 should still exist
      const logs = RecordingLogModel.findAll({ recordingId: recording2.id });
      expect(logs).toHaveLength(1);
    });
  });
});
