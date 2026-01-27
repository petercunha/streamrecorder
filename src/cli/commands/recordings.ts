import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import fs from 'fs';
import { RecordingModel, StreamerModel } from '../../lib/models';
import recordingService from '../../lib/services/recording-service';

export const recordingCommands = new Command('recordings')
  .alias('r')
  .description('Manage recordings');

// List recordings
recordingCommands
  .command('list')
  .alias('ls')
  .description('List all recordings')
  .option('-s, --status <status>', 'Filter by status (recording, completed, error, stopped)')
  .option('-u, --streamer <username>', 'Filter by streamer username')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .option('--search <query>', 'Search in title or username')
  .action((options) => {
    const recordings = RecordingModel.findAll({
      status: options.status,
      streamerId: options.streamer ? StreamerModel.findByUsername(options.streamer)?.id : undefined,
      search: options.search,
      limit: parseInt(options.limit),
    });

    if (recordings.length === 0) {
      console.log(chalk.yellow('No recordings found.'));
      return;
    }

    const table = new Table({
      head: [chalk.white.bold('ID'), chalk.white.bold('Streamer'), chalk.white.bold('Title'), chalk.white.bold('Status'), chalk.white.bold('Size'), chalk.white.bold('Duration'), chalk.white.bold('Started')],
      colWidths: [6, 15, 25, 12, 10, 10, 20],
    });

    recordings.forEach((r) => {
      const statusColor = {
        recording: chalk.yellow,
        completed: chalk.green,
        error: chalk.red,
        stopped: chalk.gray,
      }[r.status] || chalk.white;

      const size = formatBytes(r.file_size_bytes);
      const duration = formatDuration(r.duration_seconds);
      const started = new Date(r.started_at).toLocaleString();

      table.push([
        r.id,
        chalk.cyan(r.streamer_username),
        r.stream_title ? r.stream_title.substring(0, 22) + (r.stream_title.length > 22 ? '...' : '') : '-',
        statusColor(r.status),
        size,
        duration,
        started,
      ]);
    });

    console.log(table.toString());
    console.log(chalk.gray(`\nTotal: ${recordings.length} recordings`));
  });

// Show recording info
recordingCommands
  .command('info <id>')
  .description('Show detailed info about a recording')
  .action((id) => {
    const recordingId = parseInt(id);
    const recording = RecordingModel.findById(recordingId);

    if (!recording) {
      console.log(chalk.red(`Recording with ID ${id} not found`));
      return;
    }

    const statusColor = {
      recording: chalk.yellow,
      completed: chalk.green,
      error: chalk.red,
      stopped: chalk.gray,
    }[recording.status] || chalk.white;

    console.log(chalk.magenta.bold(`\n🎬 Recording #${recording.id}\n`));
    console.log(`  Streamer: ${chalk.cyan(recording.streamer_username)}`);
    console.log(`  Title: ${recording.stream_title || '-'}`);
    console.log(`  Category: ${recording.stream_category || '-'}`);
    console.log(`  Status: ${statusColor(recording.status)}`);
    console.log(`  Quality: ${recording.quality || '-'}`);
    console.log(`  File Size: ${formatBytes(recording.file_size_bytes)}`);
    console.log(`  Duration: ${formatDuration(recording.duration_seconds)}`);
    console.log(`  Started: ${new Date(recording.started_at).toLocaleString()}`);
    console.log(`  Ended: ${recording.ended_at ? new Date(recording.ended_at).toLocaleString() : '-'}`);
    console.log(`  File Path: ${recording.file_path}`);
    if (recording.error_message) {
      console.log(`  Error: ${chalk.red(recording.error_message)}`);
    }
    console.log();
  });

// Delete recording
recordingCommands
  .command('delete <id>')
  .alias('rm')
  .description('Delete a recording')
  .option('-f, --force', 'Skip confirmation')
  .option('--keep-file', 'Keep the video file, only delete the database record')
  .action(async (id, options) => {
    const recordingId = parseInt(id);
    const recording = RecordingModel.findById(recordingId);

    if (!recording) {
      console.log(chalk.red(`Recording with ID ${id} not found`));
      return;
    }

    if (!options.force) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to delete recording #${id} (${recording.streamer_username})?`,
        default: false,
      }]);

      if (!confirm) {
        console.log(chalk.gray('Cancelled'));
        return;
      }
    }

    // Delete file if exists and not keeping
    if (!options.keepFile && fs.existsSync(recording.file_path)) {
      try {
        fs.unlinkSync(recording.file_path);
        console.log(chalk.gray('Deleted video file'));
      } catch (error) {
        console.log(chalk.yellow('Warning: Could not delete video file'));
      }
    }

    const deleted = RecordingModel.delete(recordingId);
    if (deleted) {
      console.log(chalk.green(`✓ Deleted recording #${id}`));
    } else {
      console.log(chalk.red('Failed to delete recording'));
    }
  });

// Start recording
recordingCommands
  .command('start <username>')
  .description('Start recording a streamer immediately')
  .action(async (username) => {
    const streamer = StreamerModel.findByUsername(username);
    
    if (!streamer) {
      console.log(chalk.red(`Streamer "${username}" not found. Add them first with: twitch-recorder streamers add ${username}`));
      return;
    }

    if (recordingService.isRecording(streamer.id)) {
      console.log(chalk.yellow(`Already recording ${username}`));
      return;
    }

    console.log(chalk.blue(`Starting recording for ${username}...`));
    
    try {
      const recordingId = await recordingService.startRecording(streamer.id);
      console.log(chalk.green(`✓ Started recording #${recordingId}`));
    } catch (error: any) {
      console.error(chalk.red('Failed to start recording:'), error.message);
    }
  });

// Stop recording
recordingCommands
  .command('stop <username>')
  .description('Stop recording a streamer')
  .action(async (username) => {
    const streamer = StreamerModel.findByUsername(username);
    
    if (!streamer) {
      console.log(chalk.red(`Streamer "${username}" not found`));
      return;
    }

    if (!recordingService.isRecording(streamer.id)) {
      console.log(chalk.yellow(`Not currently recording ${username}`));
      return;
    }

    console.log(chalk.blue(`Stopping recording for ${username}...`));
    
    const stopped = await recordingService.stopRecording(streamer.id);
    if (stopped) {
      console.log(chalk.green(`✓ Stopped recording`));
    } else {
      console.log(chalk.red('Failed to stop recording'));
    }
  });

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '-';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m ${secs}s`;
}
