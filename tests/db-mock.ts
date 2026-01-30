import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

// In-memory database singleton for tests
let testDb: DatabaseType | null = null;

export function getTestDb(): DatabaseType {
  if (!testDb) {
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
    
    // Create tables
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS streamers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT 1,
        auto_record BOOLEAN DEFAULT 1,
        quality_preference TEXT DEFAULT 'best',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    testDb.exec(`
      CREATE TABLE IF NOT EXISTS recordings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        streamer_id INTEGER NOT NULL,
        stream_title TEXT,
        stream_category TEXT,
        file_path TEXT NOT NULL,
        file_size_bytes INTEGER DEFAULT 0,
        duration_seconds INTEGER DEFAULT 0,
        quality TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        status TEXT DEFAULT 'recording',
        error_message TEXT,
        FOREIGN KEY (streamer_id) REFERENCES streamers(id) ON DELETE CASCADE
      )
    `);

    testDb.exec(`
      CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        total_downloaded_bytes INTEGER DEFAULT 0,
        total_recordings INTEGER DEFAULT 0,
        total_streamers INTEGER DEFAULT 0,
        active_recordings INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    testDb.exec(`INSERT OR IGNORE INTO stats (id) VALUES (1)`);

    testDb.exec(`
      CREATE TABLE IF NOT EXISTS recording_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recording_id INTEGER,
        streamer_username TEXT,
        message TEXT NOT NULL,
        level TEXT DEFAULT 'info',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
      )
    `);

    testDb.exec(`
      CREATE TABLE IF NOT EXISTS service_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        is_running BOOLEAN DEFAULT 0,
        started_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    testDb.exec(`INSERT OR IGNORE INTO service_state (id, is_running) VALUES (1, 0)`);
  }
  return testDb;
}

export function resetTestDb(): DatabaseType {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
  return getTestDb();
}

export function clearTestDb(): void {
  const db = getTestDb();
  const tables = ['recording_logs', 'recordings', 'streamers', 'stats', 'service_state'];
  for (const table of tables) {
    try {
      db.exec(`DELETE FROM ${table}`);
    } catch {
      // Table might not exist
    }
  }
  db.exec(`INSERT OR IGNORE INTO stats (id) VALUES (1)`);
  db.exec(`INSERT OR IGNORE INTO service_state (id, is_running) VALUES (1, 0)`);
}
