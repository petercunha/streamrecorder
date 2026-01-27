import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { StatsModel, RecordingModel, StreamerModel } from '../../lib/models';
import recordingService from '../../lib/services/recording-service';

export const statsCommands = new Command('stats')
  .alias('st')
  .description('Show system statistics');

// Show all stats
statsCommands
  .command('show')
  .alias('s')
  .description('Show system statistics')
  .action(() => {
    const stats = StatsModel.getSystemStats();
    const recordingStats = RecordingModel.getStats();

    console.log(chalk.magenta.bold('\n📊 System Statistics\n'));

    // Main stats table
    const table = new Table({
      colWidths: [30, 20],
    });

    table.push(
      [chalk.gray('Total Downloaded'), chalk.cyan.bold(stats.totalDownloaded)],
      [chalk.gray('Active Recordings'), stats.activeRecordings > 0 ? chalk.yellow.bold(stats.activeRecordings) : chalk.gray('0')],
      [chalk.gray('Total Streamers'), chalk.white(stats.totalStreamers.toString())],
      [chalk.gray('Total Recordings'), chalk.white(stats.totalRecordings.toString())]
    );

    console.log(table.toString());

    // Recording status breakdown
    console.log(chalk.magenta.bold('\n📹 Recording Status\n'));
    
    const statusTable = new Table({
      head: [chalk.white.bold('Status'), chalk.white.bold('Count')],
      colWidths: [20, 15],
    });

    statusTable.push(
      [chalk.yellow('Recording'), recordingStats.recording.toString()],
      [chalk.green('Completed'), recordingStats.completed.toString()],
      [chalk.red('Error'), recordingStats.error.toString()],
      [chalk.gray('Stopped'), recordingStats.stopped.toString()]
    );

    console.log(statusTable.toString());

    // Active recordings
    const activeRecordings = recordingService.getActiveRecordings();
    if (activeRecordings.length > 0) {
      console.log(chalk.magenta.bold('\n▶️ Active Recordings\n'));
      
      const activeTable = new Table({
        head: [chalk.white.bold('Streamer'), chalk.white.bold('Started'), chalk.white.bold('Duration')],
        colWidths: [20, 25, 15],
      });

      activeRecordings.forEach((r) => {
        const duration = Math.floor((Date.now() - r.startTime.getTime()) / 1000);
        activeTable.push([
          chalk.cyan(r.username),
          r.startTime.toLocaleString(),
          formatDuration(duration),
        ]);
      });

      console.log(activeTable.toString());
    }

    console.log();
  });

// Show active recordings
statsCommands
  .command('active')
  .alias('a')
  .description('Show currently active recordings')
  .action(() => {
    const activeRecordings = recordingService.getActiveRecordings();

    if (activeRecordings.length === 0) {
      console.log(chalk.gray('No active recordings'));
      return;
    }

    console.log(chalk.magenta.bold(`\n▶️ ${activeRecordings.length} Active Recording(s)\n`));

    const table = new Table({
      head: [chalk.white.bold('ID'), chalk.white.bold('Streamer'), chalk.white.bold('Started'), chalk.white.bold('Duration'), chalk.white.bold('File')],
      colWidths: [6, 15, 25, 12, 30],
    });

    activeRecordings.forEach((r) => {
      const duration = Math.floor((Date.now() - r.startTime.getTime()) / 1000);
      table.push([
        r.recordingId,
        chalk.cyan(r.username),
        r.startTime.toLocaleString(),
        formatDuration(duration),
        r.filePath.split('/').pop() || r.filePath,
      ]);
    });

    console.log(table.toString());
    console.log();
  });

// Show download speed
statsCommands
  .command('speed')
  .description('Show current download speed')
  .action(() => {
    const speed = recordingService.getTotalDownloadSpeed();
    const activeCount = recordingService.getActiveCount();

    console.log(chalk.magenta.bold('\n⬇️ Download Speed\n'));
    console.log(`  Current Speed: ${chalk.cyan.bold(speed)}`);
    console.log(`  Active Streams: ${chalk.white(activeCount.toString())}`);
    console.log();
  });

// Show storage info
statsCommands
  .command('storage')
  .description('Show storage information')
  .action(() => {
    const totalDownloaded = RecordingModel.getTotalDownloaded();
    const recordingStats = RecordingModel.getStats();

    console.log(chalk.magenta.bold('\n💾 Storage Information\n'));
    console.log(`  Total Downloaded: ${chalk.cyan.bold(formatBytes(totalDownloaded))}`);
    console.log(`  Completed Recordings: ${chalk.white(recordingStats.completed.toString())}`);
    console.log(`  Failed Recordings: ${chalk.red(recordingStats.error.toString())}`);
    console.log();
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
  if (seconds === 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m ${secs}s`;
}
