#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initDatabase } from '../lib/db';
import { streamerCommands } from './commands/streamers';
import { recordingCommands } from './commands/recordings';
import { statsCommands } from './commands/stats';
import { serviceCommands } from './commands/service';

const program = new Command();

program
  .name('twitch-recorder')
  .description('CLI for managing Twitch stream recordings')
  .version('1.0.0')
  .hook('preAction', () => {
    // Initialize database before any command
    initDatabase();
  });

// Add command groups
program.addCommand(streamerCommands);
program.addCommand(recordingCommands);
program.addCommand(statsCommands);
program.addCommand(serviceCommands);

// Default action
program.action(() => {
  console.log(chalk.magenta.bold('\n🎥 Twitch Recorder CLI\n'));
  console.log('Use --help to see available commands\n');
});

program.parse();
