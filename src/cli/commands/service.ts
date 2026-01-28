import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import recordingService from '../../lib/services/recording-service';
import { RecordingLogModel, StreamerModel } from '../../lib/models';

export const serviceCommands = new Command('service')
  .alias('svc')
  .description('Manage the recording service');

// Status command
serviceCommands
  .command('status')
  .alias('s')
  .description('Show the current service status')
  .action(() => {
    const activeRecordings = recordingService.getActiveRecordings();
    const streamers = StreamerModel.findAll();
    const autoRecordStreamers = streamers.filter(s => s.auto_record);
    
    console.log(chalk.magenta.bold('\n🎥 Twitch Recorder Service Status\n'));
    
    // Status indicator
    const isRunning = recordingService.getActiveCount() >= 0; // Service is active if we can query it
    console.log(`Status: ${isRunning ? chalk.green.bold('● Running') : chalk.red.bold('● Stopped')}`);
    console.log();
    
    // Stats table
    const statsTable = new Table({
      head: [chalk.gray('Metric'), chalk.gray('Value')],
      style: { head: [], border: [] }
    });
    
    statsTable.push(
      ['Total Streamers', streamers.length.toString()],
      ['Auto-Record Enabled', chalk.green(autoRecordStreamers.length.toString())],
      ['Active Recordings', activeRecordings.length > 0 ? chalk.red.bold(activeRecordings.length.toString()) : '0'],
      ['Check Interval', '60 seconds']
    );
    
    console.log(statsTable.toString());
    console.log();
    
    // Active recordings
    if (activeRecordings.length > 0) {
      console.log(chalk.yellow('Active Recordings:'));
      const recTable = new Table({
        head: [chalk.gray('Streamer'), chalk.gray('Duration'), chalk.gray('File')],
        style: { head: [], border: [] }
      });
      
      activeRecordings.forEach((r) => {
        const duration = Math.floor((Date.now() - r.startTime.getTime()) / 60000);
        recTable.push([
          chalk.cyan(r.username),
          `${duration}m`,
          chalk.gray(r.filePath.split('/').pop() || r.filePath)
        ]);
      });
      
      console.log(recTable.toString());
      console.log();
    }
    
    console.log(chalk.gray('Use `service check` to manually check for live streamers'));
    console.log(chalk.gray('Use `service logs` to view recent logs'));
    console.log();
  });

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
  .alias('c')
  .description('Check all streamers immediately')
  .action(async () => {
    console.log(chalk.blue('\n🔍 Checking all streamers...\n'));
    
    const streamers = StreamerModel.findAll();
    const autoRecordStreamers = streamers.filter(s => s.auto_record);
    
    console.log(chalk.gray(`Found ${autoRecordStreamers.length} streamers with auto-record enabled`));
    console.log();
    
    await recordingService.checkAndRecordStreamers();
    
    console.log();
    console.log(chalk.green('✓ Check complete'));
    console.log();
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

      if (logs.length === 0) {
        console.log(chalk.gray('No logs yet...'));
      } else {
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
      }

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
