import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { clearTestDb, getTestDb } from '../../../../tests/db-mock';
import { StreamerModel } from '../streamer';

describe('StreamerModel', () => {
  beforeEach(() => {
    clearTestDb();
  });

  afterAll(() => {
    const db = getTestDb();
    db.close();
  });

  describe('create', () => {
    it('should create a streamer with default values', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });

      expect(streamer).toBeDefined();
      expect(streamer.username).toBe('testuser');
      expect(streamer.display_name).toBe('testuser');
      expect(streamer.avatar_url).toBeNull();
      expect(streamer.is_active).toBe(1);
      expect(streamer.auto_record).toBe(1);
      expect(streamer.quality_preference).toBe('best');
      expect(streamer.id).toBeDefined();
      expect(streamer.created_at).toBeDefined();
      expect(streamer.updated_at).toBeDefined();
    });

    it('should normalize username to lowercase', () => {
      const streamer = StreamerModel.create({ username: 'TestUser123' });
      expect(streamer.username).toBe('testuser123');
    });

    it('should accept custom display name', () => {
      const streamer = StreamerModel.create({
        username: 'testuser',
        display_name: 'Test User',
      });
      expect(streamer.display_name).toBe('Test User');
    });

    it('should accept custom avatar_url', () => {
      const streamer = StreamerModel.create({
        username: 'testuser',
        avatar_url: 'https://example.com/avatar.jpg',
      });
      expect(streamer.avatar_url).toBe('https://example.com/avatar.jpg');
    });

    it('should accept custom auto_record setting', () => {
      const streamer = StreamerModel.create({
        username: 'testuser',
        auto_record: false,
      });
      expect(streamer.auto_record).toBe(0);
    });

    it('should accept custom quality_preference', () => {
      const streamer = StreamerModel.create({
        username: 'testuser',
        quality_preference: '720p',
      });
      expect(streamer.quality_preference).toBe('720p');
    });

    it('should throw error for duplicate username', () => {
      StreamerModel.create({ username: 'testuser' });
      
      expect(() => {
        StreamerModel.create({ username: 'testuser' });
      }).toThrow();
    });
  });

  describe('findAll', () => {
    it('should return empty array when no streamers exist', () => {
      const streamers = StreamerModel.findAll();
      expect(streamers).toEqual([]);
    });

    it('should return all active streamers by default', () => {
      StreamerModel.create({ username: 'user1' });
      StreamerModel.create({ username: 'user2' });
      
      const streamers = StreamerModel.findAll();
      expect(streamers).toHaveLength(2);
      expect(streamers.map(s => s.username)).toContain('user1');
      expect(streamers.map(s => s.username)).toContain('user2');
    });

    it('should exclude inactive streamers by default', () => {
      const streamer = StreamerModel.create({ username: 'active' });
      const inactive = StreamerModel.create({ username: 'inactive' });
      
      StreamerModel.update(inactive.id, { is_active: false });
      
      const streamers = StreamerModel.findAll();
      expect(streamers).toHaveLength(1);
      expect(streamers[0].username).toBe('active');
    });

    it('should include inactive streamers when includeInactive is true', () => {
      const active = StreamerModel.create({ username: 'active' });
      const inactive = StreamerModel.create({ username: 'inactive' });
      
      StreamerModel.update(inactive.id, { is_active: false });
      
      const streamers = StreamerModel.findAll(true);
      expect(streamers).toHaveLength(2);
    });

    it('should return streamers sorted by username', () => {
      StreamerModel.create({ username: 'charlie' });
      StreamerModel.create({ username: 'alice' });
      StreamerModel.create({ username: 'bob' });
      
      const streamers = StreamerModel.findAll();
      expect(streamers[0].username).toBe('alice');
      expect(streamers[1].username).toBe('bob');
      expect(streamers[2].username).toBe('charlie');
    });
  });

  describe('findById', () => {
    it('should return streamer by id', () => {
      const created = StreamerModel.create({ username: 'testuser' });
      const found = StreamerModel.findById(created.id);
      
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.username).toBe('testuser');
    });

    it('should return undefined for non-existent id', () => {
      const found = StreamerModel.findById(999999);
      expect(found).toBeUndefined();
    });
  });

  describe('findByUsername', () => {
    it('should find streamer by username (case insensitive)', () => {
      StreamerModel.create({ username: 'TestUser' });
      
      const found = StreamerModel.findByUsername('TESTUSER');
      expect(found).toBeDefined();
      expect(found?.username).toBe('testuser');
    });

    it('should return undefined for non-existent username', () => {
      const found = StreamerModel.findByUsername('nonexistent');
      expect(found).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update display_name', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      const updated = StreamerModel.update(streamer.id, { display_name: 'New Name' });
      
      expect(updated?.display_name).toBe('New Name');
    });

    it('should update avatar_url', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      const updated = StreamerModel.update(streamer.id, { 
        avatar_url: 'https://new.avatar.jpg' 
      });
      
      expect(updated?.avatar_url).toBe('https://new.avatar.jpg');
    });

    it('should update is_active', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      const updated = StreamerModel.update(streamer.id, { is_active: false });
      
      expect(updated?.is_active).toBe(0);
    });

    it('should update auto_record', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      const updated = StreamerModel.update(streamer.id, { auto_record: false });
      
      expect(updated?.auto_record).toBe(0);
    });

    it('should update quality_preference', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      const updated = StreamerModel.update(streamer.id, { quality_preference: '720p60' });
      
      expect(updated?.quality_preference).toBe('720p60');
    });

    it('should update multiple fields at once', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      const updated = StreamerModel.update(streamer.id, {
        display_name: 'New Name',
        quality_preference: '1080p60',
        auto_record: false,
      });
      
      expect(updated?.display_name).toBe('New Name');
      expect(updated?.quality_preference).toBe('1080p60');
      expect(updated?.auto_record).toBe(0);
    });

    it('should update updated_at timestamp', async () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      const originalUpdatedAt = streamer.updated_at;
      
      // Wait a bit to ensure timestamp changes (SQLite has second precision)
      await new Promise(r => setTimeout(r, 1100));
      
      const updated = StreamerModel.update(streamer.id, { display_name: 'New Name' });
      expect(updated?.updated_at).not.toBe(originalUpdatedAt);
    });

    it('should return undefined for non-existent id', () => {
      const updated = StreamerModel.update(999999, { display_name: 'New Name' });
      expect(updated).toBeUndefined();
    });

    it('should return original streamer when no fields provided', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      const updated = StreamerModel.update(streamer.id, {});
      
      expect(updated?.id).toBe(streamer.id);
      expect(updated?.username).toBe(streamer.username);
    });
  });

  describe('delete', () => {
    it('should delete streamer and return true', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      const deleted = StreamerModel.delete(streamer.id);
      
      expect(deleted).toBe(true);
      expect(StreamerModel.findById(streamer.id)).toBeUndefined();
    });

    it('should return false for non-existent id', () => {
      const deleted = StreamerModel.delete(999999);
      expect(deleted).toBe(false);
    });
  });

  describe('count', () => {
    it('should return 0 when no streamers exist', () => {
      expect(StreamerModel.count()).toBe(0);
    });

    it('should return count of active streamers', () => {
      StreamerModel.create({ username: 'user1' });
      StreamerModel.create({ username: 'user2' });
      StreamerModel.create({ username: 'user3' });
      
      expect(StreamerModel.count()).toBe(3);
    });

    it('should not count inactive streamers', () => {
      const streamer = StreamerModel.create({ username: 'testuser' });
      StreamerModel.update(streamer.id, { is_active: false });
      
      expect(StreamerModel.count()).toBe(0);
    });
  });
});
