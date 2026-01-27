# TwitchRecorder

A comprehensive TypeScript application for recording Twitch livestreams, featuring both a powerful CLI interface and a beautiful web dashboard built with Next.js 16 and ShadCN UI.

![TwitchRecorder](https://img.shields.io/badge/Twitch-Recorder-9146FF?style=for-the-badge&logo=twitch&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

## Features

### CLI Interface
- **Streamer Management**: Add, remove, edit, and list streamers to monitor
- **Recording Control**: Start/stop recordings manually or enable auto-recording
- **Statistics**: View system stats including total downloaded, active recordings, and more
- **Activity Logs**: Real-time logs of recording activity
- **Service Mode**: Run as a background service with auto-checking for live streams

### Web Interface
- **Dashboard**: Beautiful overview with stats cards and activity monitoring
- **Streamer Management**: Full CRUD interface for managing streamers
- **Recordings Browser**: Search, filter, and manage recorded streams
- **Live Monitoring**: Real-time activity logs and recording status
- **Responsive Design**: Works on desktop and mobile devices

### Core Features
- **Streamlink Integration**: Uses streamlink-cli for high-quality stream downloads
- **SQLite Database**: Local storage for all metadata and statistics
- **Auto-Recording**: Automatically start recording when monitored streamers go live
- **Quality Selection**: Choose preferred quality for each streamer
- **Ad Blocking**: Built-in Twitch ad blocking via streamlink

## Prerequisites

- Node.js 18+ 
- npm or yarn
- streamlink-cli installed on your system

### Installing Streamlink

**macOS:**
```bash
brew install streamlink
```

**Ubuntu/Debian:**
```bash
sudo apt-get install streamlink
```

**Windows:**
```bash
pip install streamlink
```

**Or visit:** https://streamlink.github.io/install.html

## Installation

1. Clone or download this repository:
```bash
cd twitch-recorder
```

2. Install dependencies:
```bash
npm install
```

3. Build the CLI:
```bash
npm run cli:build
```

4. (Optional) Link the CLI globally:
```bash
npm link
```

## Usage

### CLI Commands

#### Streamer Management
```bash
# List all streamers
twitch-recorder streamers list
twitch-recorder s ls

# Add a new streamer
twitch-recorder streamers add <username>
twitch-recorder s add shroud --quality 1080p60 --auto

# Remove a streamer
twitch-recorder streamers remove <id>
twitch-recorder s rm 1

# Edit a streamer
twitch-recorder streamers edit <id>

# Show streamer info
twitch-recorder streamers info <id>
```

#### Recording Management
```bash
# List all recordings
twitch-recorder recordings list
twitch-recorder r ls

# Show recording info
twitch-recorder recordings info <id>

# Delete a recording
twitch-recorder recordings delete <id>
twitch-recorder r rm 1

# Start recording manually
twitch-recorder recordings start <username>

# Stop recording
twitch-recorder recordings stop <username>
```

#### Statistics
```bash
# Show all stats
twitch-recorder stats show
twitch-recorder st s

# Show active recordings
twitch-recorder stats active
twitch-recorder st a

# Show download speed
twitch-recorder stats speed

# Show storage info
twitch-recorder stats storage
```

#### Service Mode
```bash
# Start the auto-recording service
twitch-recorder service start
twitch-recorder svc start

# Check streamers immediately
twitch-recorder service check

# View logs
twitch-recorder service logs
twitch-recorder service logs --follow
```

### Web Interface

1. Start the development server:
```bash
npm run dev
```

2. Open your browser to `http://localhost:3000`

3. For production:
```bash
npm run build
npm start
```

## Project Structure

```
twitch-recorder/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/               # API routes
│   │   │   ├── logs/
│   │   │   ├── recordings/
│   │   │   ├── stats/
│   │   │   └── streamers/
│   │   ├── components/        # React components
│   │   ├── streamers/         # Streamers page
│   │   ├── recordings/        # Recordings page
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx           # Dashboard
│   ├── cli/                   # CLI interface
│   │   ├── commands/
│   │   │   ├── recordings.ts
│   │   │   ├── service.ts
│   │   │   ├── stats.ts
│   │   │   └── streamers.ts
│   │   └── index.ts
│   ├── components/ui/         # ShadCN UI components
│   └── lib/
│       ├── db.ts              # Database initialization
│       ├── models/            # Data models
│       │   ├── index.ts
│       │   ├── recording-log.ts
│       │   ├── recording.ts
│       │   ├── stats.ts
│       │   └── streamer.ts
│       ├── services/          # Business logic
│       │   └── recording-service.ts
│       └── utils.ts
├── data/                      # SQLite database
├── recordings/                # Recorded streams
├── package.json
├── tsconfig.json
├── tsconfig.cli.json
└── next.config.ts
```

## Database Schema

### Streamers Table
- `id`: Primary key
- `username`: Twitch username (unique)
- `display_name`: Optional display name
- `is_active`: Whether the streamer is active
- `auto_record`: Auto-record when live
- `quality_preference`: Preferred quality (best, 1080p60, etc.)
- `created_at`, `updated_at`: Timestamps

### Recordings Table
- `id`: Primary key
- `streamer_id`: Foreign key to streamers
- `stream_title`, `stream_category`: Stream metadata
- `file_path`: Path to recorded file
- `file_size_bytes`: Size of recording
- `duration_seconds`: Recording duration
- `quality`: Actual quality recorded
- `started_at`, `ended_at`: Timestamps
- `status`: recording, completed, error, stopped
- `error_message`: Error details if failed

### Stats Table
- Aggregated statistics for quick access
- `total_downloaded_bytes`
- `total_recordings`
- `total_streamers`
- `active_recordings`

### Recording Logs Table
- Real-time activity logging
- `recording_id`: Optional link to recording
- `streamer_username`: Who the log is about
- `message`: Log message
- `level`: info, warn, error, success
- `created_at`: Timestamp

## Environment Variables

```bash
# Data directory (default: ./data)
DATA_DIR=/path/to/data

# Recordings directory (default: ./recordings)
RECORDINGS_DIR=/path/to/recordings
```

## API Endpoints

### Stats
- `GET /api/stats` - Get system statistics

### Streamers
- `GET /api/streamers` - List all streamers
- `POST /api/streamers` - Create new streamer
- `GET /api/streamers/:id` - Get streamer details
- `PATCH /api/streamers/:id` - Update streamer
- `DELETE /api/streamers/:id` - Delete streamer

### Recordings
- `GET /api/recordings` - List recordings (with filters)
- `GET /api/recordings/active` - Get active recordings
- `POST /api/recordings/start/:id` - Start recording
- `POST /api/recordings/stop/:id` - Stop recording

### Logs
- `GET /api/logs` - Get recent logs

## Development

### Running in Development Mode

```bash
# Terminal 1: Web interface
npm run dev

# Terminal 2: CLI (using tsx)
npm run cli:dev -- streamers list
```

### Building

```bash
# Build web interface
npm run build

# Build CLI
npm run cli:build
```

### Adding ShadCN Components

```bash
npx shadcn@latest add <component-name>
```

## Troubleshooting

### Streamlink not found
Make sure streamlink is installed and available in your PATH:
```bash
which streamlink
streamlink --version
```

### Permission errors
If you get permission errors when recording, ensure the `recordings` directory is writable:
```bash
chmod 755 recordings
```

### Database locked
If you see "database is locked" errors, wait a moment and try again. SQLite WAL mode is enabled for better concurrency.

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Acknowledgments

- [Streamlink](https://streamlink.github.io/) - For the amazing stream extraction tool
- [Next.js](https://nextjs.org/) - For the React framework
- [ShadCN UI](https://ui.shadcn.com/) - For the beautiful UI components
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - For the SQLite integration
