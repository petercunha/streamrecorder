import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import { StreamerModel } from '../../lib/models';

export const streamerCommands = new Command('streamers')
  .alias('s')
  .description('Manage streamers to record');

// List streamers
streamerCommands
  .command('list')
  .alias('ls')
  .description('List all streamers')
  .option('-a, --all', 'Include inactive streamers')
  .action((options) => {
    const streamers = StreamerModel.findAll(!options.all);
    
    if (streamers.length === 0) {
      console.log(chalk.yellow('No streamers found. Add one with: twitch-recorder streamers add <username>'));
      return;
    }

    const table = new Table({
      head: [chalk.white.bold('ID'), chalk.white.bold('Username'), chalk.white.bold('Display Name'), chalk.white.bold('Auto Record'), chalk.white.bold('Quality'), chalk.white.bold('Status')],
      colWidths: [6, 20, 20, 12, 10, 10],
    });

    streamers.forEach((s) => {
      table.push([
        s.id,
        chalk.cyan(s.username),
        s.display_name || '-',
        s.auto_record ? chalk.green('Yes') : chalk.red('No'),
        s.quality_preference,
        s.is_active ? chalk.green('Active') : chalk.gray('Inactive'),
      ]);
    });

    console.log(table.toString());
    console.log(chalk.gray(`\nTotal: ${streamers.length} streamers`));
  });

// Add streamer
streamerCommands
  .command('add <username>')
  .description('Add a new streamer to record')
  .option('-n, --name <displayName>', 'Display name')
  .option('-q, --quality <quality>', 'Quality preference (best, 1080p60, 720p60, etc.)', 'best')
  .option('--no-auto', 'Disable auto-recording')
  .action(async (username, options) => {
    try {
      // Check if already exists
      const existing = StreamerModel.findByUsername(username);
      if (existing) {
        console.log(chalk.yellow(`Streamer "${username}" already exists!`));
        return;
      }

      const streamer = StreamerModel.create({
        username,
        display_name: options.name,
        auto_record: options.auto,
        quality_preference: options.quality,
      });

      console.log(chalk.green(`✓ Added streamer: ${streamer.username}`));
      console.log(chalk.gray(`  ID: ${streamer.id}`));
      console.log(chalk.gray(`  Auto-record: ${streamer.auto_record ? 'Yes' : 'No'}`));
      console.log(chalk.gray(`  Quality: ${streamer.quality_preference}`));
    } catch (error) {
      console.error(chalk.red('Error adding streamer:'), error);
    }
  });

// Remove streamer
streamerCommands
  .command('remove <id>')
  .alias('rm')
  .description('Remove a streamer')
  .option('-f, --force', 'Skip confirmation')
  .action(async (id, options) => {
    const streamerId = parseInt(id);
    const streamer = StreamerModel.findById(streamerId);
    
    if (!streamer) {
      console.log(chalk.red(`Streamer with ID ${id} not found`));
      return;
    }

    if (!options.force) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to remove "${streamer.username}"?`,
        default: false,
      }]);

      if (!confirm) {
        console.log(chalk.gray('Cancelled'));
        return;
      }
    }

    const deleted = StreamerModel.delete(streamerId);
    if (deleted) {
      console.log(chalk.green(`✓ Removed streamer: ${streamer.username}`));
    } else {
      console.log(chalk.red('Failed to remove streamer'));
    }
  });

// Edit streamer
streamerCommands
  .command('edit <id>')
  .description('Edit a streamer')
  .action(async (id) => {
    const streamerId = parseInt(id);
    const streamer = StreamerModel.findById(streamerId);
    
    if (!streamer) {
      console.log(chalk.red(`Streamer with ID ${id} not found`));
      return;
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'display_name',
        message: 'Display name:',
        default: streamer.display_name || streamer.username,
      },
      {
        type: 'confirm',
        name: 'auto_record',
        message: 'Auto-record when live:',
        default: streamer.auto_record,
      },
      {
        type: 'list',
        name: 'quality_preference',
        message: 'Quality preference:',
        choices: ['best', '1080p60', '1080p', '720p60', '720p', '480p', '360p', 'worst'],
        default: streamer.quality_preference,
      },
      {
        type: 'confirm',
        name: 'is_active',
        message: 'Active:',
        default: streamer.is_active,
      },
    ]);

    const updated = StreamerModel.update(streamerId, answers);
    if (updated) {
      console.log(chalk.green(`✓ Updated streamer: ${updated.username}`));
    } else {
      console.log(chalk.red('Failed to update streamer'));
    }
  });

// Show streamer info
streamerCommands
  .command('info <id>')
  .description('Show detailed info about a streamer')
  .action((id) => {
    const streamerId = parseInt(id);
    const streamer = StreamerModel.findById(streamerId);
    
    if (!streamer) {
      console.log(chalk.red(`Streamer with ID ${id} not found`));
      return;
    }

    console.log(chalk.magenta.bold(`\n📺 ${streamer.username}\n`));
    console.log(`  ID: ${streamer.id}`);
    console.log(`  Display Name: ${streamer.display_name || '-'}`);
    console.log(`  Auto-record: ${streamer.auto_record ? chalk.green('Yes') : chalk.red('No')}`);
    console.log(`  Quality: ${streamer.quality_preference}`);
    console.log(`  Status: ${streamer.is_active ? chalk.green('Active') : chalk.gray('Inactive')}`);
    console.log(`  Created: ${new Date(streamer.created_at).toLocaleString()}`);
    console.log(`  Updated: ${new Date(streamer.updated_at).toLocaleString()}`);
    console.log();
  });
