import { Command } from 'commander'
import { installCommandCommand } from './commands/install-command.js'
import { initCommand } from './commands/init.js'
import { scanCommand } from './commands/scan.js'
import { updateCommand } from './commands/update.js'
import { statusCommand } from './commands/status.js'
import { loadCommand } from './commands/load.js'
import { watchCommand } from './commands/watch.js'
import { doctorCommand } from './commands/doctor.js'
import { startMcpServer } from '../mcp/server.js'
import {
  preferencesListCommand,
  preferencesSetCommand,
  preferencesRemoveCommand,
  preferencesLearnCommand,
  preferencesClearCommand,
  preferencesExportCommand,
} from './commands/preferences.js'
import {
  obsidianConnectCommand,
  obsidianSyncCommand,
  obsidianStatusCommand,
  obsidianDisconnectCommand,
} from './commands/obsidian.js'

const program = new Command()

program
  .name('dream')
  .description('Persistent project memory for Claude Code sessions')
  .version('1.0.0')

// ─── Core commands ───────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize Dream in this repository — scans project and generates CLAUDE.md')
  .option('-f, --force', 'Reinitialize even if already set up')
  .option('--hooks', 'Install git post-commit hook for automatic updates')
  .action(async (opts) => {
    await initCommand({ force: opts.force, hooks: opts.hooks })
  })

program
  .command('scan')
  .description('Rescan the repository and regenerate CLAUDE.md from scratch')
  .option('-q, --quiet', 'Suppress output')
  .action(async (opts) => {
    await scanCommand({ quiet: opts.quiet })
  })

program
  .command('update')
  .description('Incrementally update CLAUDE.md with recent git changes')
  .option('-q, --quiet', 'Suppress output')
  .action(async (opts) => {
    await updateCommand({ quiet: opts.quiet })
  })

program
  .command('status')
  .description('Show current Dream memory state and configuration')
  .action(async () => {
    await statusCommand()
  })

program
  .command('load')
  .description('Print project memory to terminal (pipe-friendly)')
  .option('--plain', 'Output raw markdown without colors')
  .option('--no-tasks', 'Skip TASKS.md output')
  .action(async (opts) => {
    await loadCommand({ plain: opts.plain, noTasks: opts.noTasks })
  })

program
  .command('watch')
  .description('Watch for file changes and auto-update memory')
  .option('--debounce <seconds>', 'Debounce delay in seconds', '10')
  .action(async (opts) => {
    await watchCommand({ debounce: parseInt(opts.debounce, 10) })
  })

program
  .command('doctor')
  .description('Validate Dream configuration and diagnose issues')
  .action(async () => {
    await doctorCommand()
  })

program
  .command('mcp')
  .description('Start MCP server (invoked automatically by Claude Code)')
  .action(async () => {
    await startMcpServer()
  })

program
  .command('install-command')
  .description('Install the /dream slash command into Claude Code')
  .option('-g, --global', 'Install globally (~/.claude/commands/) instead of project-only')
  .action(async (opts) => {
    await installCommandCommand({ global: opts.global })
  })

// ─── Preferences commands ─────────────────────────────────────────────────────

const prefs = program.command('preferences').alias('pref').description('Manage learned user preferences')

prefs
  .command('list')
  .description('Show all recorded preferences')
  .action(async () => {
    await preferencesListCommand()
  })

prefs
  .command('set <key> <value> [category]')
  .description('Manually set a preference (categories: response-style, code-style, workflow, communication, custom)')
  .action(async (key, value, category) => {
    await preferencesSetCommand(key, value, category)
  })

prefs
  .command('remove <key>')
  .description('Remove a preference by key')
  .action(async (key) => {
    await preferencesRemoveCommand(key)
  })

prefs
  .command('learn')
  .description('Auto-detect preferences from codebase and git history')
  .action(async () => {
    await preferencesLearnCommand()
  })

prefs
  .command('clear')
  .description('Clear all preferences (cannot be undone)')
  .action(async () => {
    await preferencesClearCommand()
  })

prefs
  .command('export')
  .description('Export preferences to .dream/PREFERENCES.md')
  .action(async () => {
    await preferencesExportCommand()
  })

// ─── Obsidian commands ────────────────────────────────────────────────────────

const obsidian = program.command('obsidian').description('Manage Obsidian vault integration')

obsidian
  .command('connect [vault-path]')
  .description('Connect an Obsidian vault (auto-detects if no path given)')
  .action(async (vaultPath) => {
    await obsidianConnectCommand(vaultPath)
  })

obsidian
  .command('sync')
  .description('Manually sync project memory to Obsidian')
  .action(async () => {
    await obsidianSyncCommand()
  })

obsidian
  .command('status')
  .description('Show Obsidian integration status')
  .action(async () => {
    await obsidianStatusCommand()
  })

obsidian
  .command('disconnect')
  .description('Disconnect Obsidian vault (keeps existing vault files)')
  .action(async () => {
    await obsidianDisconnectCommand()
  })

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
