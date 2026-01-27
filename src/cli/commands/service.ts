import { Command } from 'commander';
import chalk from 'chalk';
import recordingService from '../../lib/services/recording-service';
import { RecordingLogModel } from '../../lib/models';

export const serviceCommands = new Command('service')
  .alias('svc')
  .description('Manage the recording service');

// Start service
serviceCommands
  .command('start')
  .description('Start the auto-recording service')
  .option('-i, --interval <ms>', 'Check interval in milliseconds', '60000')
  .action((options) => {
    const interval = parseInt(options.interval);
    
    console.log(chalk.magenta.bold('\n🎥 Starting Twitch Recorder Service\n'));
    console.log(chalk.gray(`Check interval: ${interval}ms`));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));

    // Start the auto-checker
    recordingService.startAutoChecker(interval);

    // Do an initial check
    recordingService.checkAndRecordStreamers();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\nShutting down...'));
      recordingService.stopAutoChecker();
      
      // Stop all active recordings
      const activeRecordings = recordingService.getActiveRecordings();
      activeRecordings.forEach((r) => {
        console.log(chalk.gray(`Stopping recording for ${r.username}...`));
        recordingService.stopRecording(r.streamerId);
      });

      setTimeout(() => {
        console.log(chalk.green('Goodbye!'));
        process.exit(0);
      }, 2000);
    });

    // Keep the process running
    setInterval(() => {
      // Heartbeat
    }, 10000);
  });

// Check now
serviceCommands
  .command('check')
  .description('Check all streamers immediately')
  .action(async () => {
    console.log(chalk.blue('Checking all streamers...'));
    await recordingService.checkAndRecordStreamers();
    console.log(chalk.green('✓ Check complete'));
  });

// Show logs
serviceCommands
  .command('logs')
  .description('Show recent recording logs')
  .option('-n, --lines <number>', 'Number of lines to show', '20')
  .option('-f, --follow', 'Follow logs (like tail -f)')
  .action((options) => {
    const lines = parseInt(options.lines);

    const showLogs = () => {
      const logs = RecordingLogModel.getRecent(lines);
      
      console.clear();
      console.log(chalk.magenta.bold(`\n📜 Recent Logs (last ${lines})\n`));

      logs.reverse().forEach((log) => {
        const time = new Date(log.created_at).toLocaleTimeString();
        const levelColor = {
          info: chalk.white,
          warn: chalk.yellow,
          error: chalk.red,
          success: chalk.green,
        }[log.level] || chalk.white;

        const prefix = log.streamer_username 
          ? chalk.cyan(`[${log.streamer_username}]`)
          : chalk.gray('[system]');

        console.log(`${chalk.gray(time)} ${prefix} ${levelColor(log.message)}`);
      });

      console.log();
    };

    showLogs();

    if (options.follow) {
      console.log(chalk.gray('Following logs... Press Ctrl+C to exit\n'));
      const interval = setInterval(showLogs, 2000);

      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log(chalk.gray('\nStopped following logs'));
        process.exit(0);
      });
    }
  });
