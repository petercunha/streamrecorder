import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Database as DatabaseType } from 'better-sqlite3';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'twitch-recorder.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize tables
export function initDatabase() {
  // Streamers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS streamers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT,
      is_active BOOLEAN DEFAULT 1,
      auto_record BOOLEAN DEFAULT 1,
      quality_preference TEXT DEFAULT 'best',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Recordings table
  db.exec(`
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

  // Stats table for aggregated data
  db.exec(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_downloaded_bytes INTEGER DEFAULT 0,
      total_recordings INTEGER DEFAULT 0,
      total_streamers INTEGER DEFAULT 0,
      active_recordings INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default stats row if not exists
  db.exec(`
    INSERT OR IGNORE INTO stats (id) VALUES (1)
  `);

  // Recording logs table for real-time activity
  db.exec(`
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

  console.log('Database initialized at:', DB_PATH);
}

export default db;
