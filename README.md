# TwitchRecorder

A comprehensive TypeScript application for recording Twitch livestreams with a beautiful web dashboard built with Next.js 16 and ShadCN UI.

![TwitchRecorder](https://img.shields.io/badge/Twitch-Recorder-9146FF?style=for-the-badge&logo=twitch&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

## Features

### Web Interface
- **Dashboard**: Beautiful overview with stats cards and activity monitoring
- **Streamer Management**: Full CRUD interface for managing streamers
- **Recordings Browser**: Search, filter, and manage recorded streams
- **Live Monitoring**: Real-time activity logs and recording status
- **Responsive Design**: Works on desktop and mobile devices
- **Auto-Recording**: Automatically start recording when monitored streamers go live
- **Manual Controls**: Start/stop recordings manually from the web interface

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
cd streamrecorder
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```
Then go to http://localhost:3000 in your browser!

4. For production:
```bash
npm run build
npm start
```

## Usage

### Web Interface

1. Start the development server:
```bash
npm run dev
```

2. Open your browser to `http://localhost:3000`

3. Add streamers to monitor via the Streamers page

4. Enable "Auto-record" on streamers you want to automatically record when they go live

5. View recordings, manage settings, and monitor activity from the web dashboard

### Managing Streamers

- **Add Streamers**: Go to `/streamers` and click "Add Streamer"
- **Edit Streamers**: Click on a streamer to edit their settings
- **Auto-Record**: Toggle auto-recording per streamer
- **Quality Preference**: Set preferred quality (best, 1080p60, 720p60, etc.)

### Recording Controls

- **Auto-Recording**: The app automatically checks every 60 seconds for live streamers
- **Manual Check**: Go to Settings and click "Check for Live Streamers Now"
- **Manual Recording**: Start/stop recordings from the streamer details page

## Project Structure

```
twitch-recorder/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/               # API routes
│   │   │   ├── logs/
│   │   │   ├── recordings/
│   │   │   ├── service/
│   │   │   ├── stats/
│   │   │   └── streamers/
│   │   ├── components/        # React components
│   │   ├── streamers/         # Streamers page
│   │   ├── recordings/        # Recordings page
│   │   ├── monitor/           # Live monitor page
│   │   ├── settings/          # Settings page
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx           # Dashboard
│   ├── components/ui/         # ShadCN UI components
│   ├── lib/
│   │   ├── db.ts              # Database initialization
│   │   ├── models/            # Data models
│   │   │   ├── index.ts
│   │   │   ├── recording-log.ts
│   │   │   ├── recording.ts
│   │   │   ├── stats.ts
│   │   │   └── streamer.ts
│   │   ├── services/          # Business logic
│   │   │   └── recording-service.ts
│   │   └── utils.ts
│   └── instrumentation.ts     # Server initialization
├── data/                      # SQLite database
├── recordings/                # Recorded streams
├── package.json
├── tsconfig.json
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

### Service
- `GET /api/service/status` - Get service status
- `POST /api/service/check` - Trigger manual check for live streamers

### Logs
- `GET /api/logs` - Get recent logs

## Development

### Running in Development Mode

```bash
npm run dev
```

### Building

```bash
npm run build
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

### Auto-recording not working
- Check that streamers have `auto_record` enabled
- Verify streamlink is installed and working: `streamlink --version`
- Check the logs at `/api/logs` for any errors
- The app checks every 60 seconds for live streamers

## Architecture Notes

This is a pure Next.js application. The auto-recording functionality runs as part of the Next.js server process:

1. **Server Initialization**: When the Next.js server starts, it initializes the database and starts the auto-recording service
2. **Auto-Recording**: The service checks every 60 seconds for streamers with `auto_record` enabled and starts recording if they're live
3. **Graceful Shutdown**: When the server is stopped (SIGTERM/SIGINT), all active recordings are properly finalized
4. **No Background Process**: Unlike previous versions, there is no separate background daemon - recording only happens while the Next.js server is running

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Acknowledgments

- [Streamlink](https://streamlink.github.io/) - For the amazing stream extraction tool
- [Next.js](https://nextjs.org/) - For the React framework
- [ShadCN UI](https://ui.shadcn.com/) - For the beautiful UI components
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - For the SQLite integration
