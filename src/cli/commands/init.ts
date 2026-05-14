import fs from 'fs/promises'
import path from 'path'
import ora from 'ora'
import chalk from 'chalk'
import { findProjectRoot, dreamDir, mcpJsonPath, claudeMdPath, tasksMdPath } from '../../utils/paths.js'
import { writeConfig, defaultConfig, readConfig } from '../../utils/config.js'
import { writeState, buildFileHashes } from '../../utils/state.js'
import { scanRepository } from '../../scanner/index.js'
import { analyzeGit } from '../../git/analyzer.js'
import { summarizeRecentActivity } from '../../git/summarizer.js'
import { generateClaudeMd } from '../../templates/claude-md.js'
import { generateTasksMd } from '../../templates/tasks-md.js'
import { writeMemory, writeTasks, ensureDreamDir } from '../../memory/manager.js'
import { estimateTokens } from '../../utils/tokens.js'
import { logger } from '../../utils/logger.js'
import { autoDetectPreferences } from '../../preferences/detector.js'
import { readPreferences } from '../../preferences/manager.js'
import { syncToObsidian } from '../../obsidian/syncer.js'
import { installCommandCommand } from './install-command.js'

interface InitOptions {
  force?: boolean
  hooks?: boolean
}

export async function initCommand(options: InitOptions = {}) {
  const projectRoot = await findProjectRoot()

  // Check for existing init
  if (!options.force) {
    try {
      await fs.access(dreamDir(projectRoot))
      const existingMemory = await fs.access(claudeMdPath(projectRoot)).then(() => true).catch(() => false)

      if (existingMemory) {
        console.log(chalk.yellow('\n  Dream is already initialized in this project.'))
        console.log(chalk.dim('  Use --force to reinitialize, or `dream scan` to refresh.\n'))
        return
      }
    } catch {}
  }

  console.log(chalk.bold.cyan('\n  ◆ Dream — Initializing project memory\n'))
  console.log(chalk.dim(`  Project root: ${projectRoot}\n`))

  // Create .dream directory
  await ensureDreamDir(projectRoot)

  // Scan repository
  const spinner = ora({ text: 'Scanning repository...', color: 'cyan' }).start()

  let memory
  try {
    memory = await scanRepository(projectRoot)
    spinner.succeed('Repository scanned')
  } catch (err) {
    spinner.fail('Scan failed')
    logger.error(String(err))
    process.exit(1)
  }

  // Get git history for RECENT CHANGES
  const gitSpinner = ora({ text: 'Analyzing git history...', color: 'cyan' }).start()
  try {
    const git = await analyzeGit(projectRoot)
    const recentActivity = summarizeRecentActivity(git)
    if (recentActivity.length > 0) {
      memory.recentChanges = recentActivity
    }
    gitSpinner.succeed('Git history analyzed')
  } catch {
    gitSpinner.warn('Git analysis skipped (not a git repo)')
  }

  // Auto-detect preferences from codebase
  const prefSpinner = ora({ text: 'Detecting preferences from code...', color: 'cyan' }).start()
  try {
    const prefCount = await autoDetectPreferences(projectRoot)
    prefSpinner.succeed(`Detected ${prefCount} preference signal${prefCount !== 1 ? 's' : ''} from code patterns`)
  } catch {
    prefSpinner.warn('Preference detection skipped')
  }
  const prefs = await readPreferences(projectRoot)

  // Generate CLAUDE.md
  const genSpinner = ora({ text: 'Generating CLAUDE.md...', color: 'cyan' }).start()
  const claudeMd = generateClaudeMd(memory, 1500, prefs)
  const tokenCount = estimateTokens(claudeMd)

  await writeMemory(projectRoot, claudeMd)
  genSpinner.succeed(`CLAUDE.md generated (~${tokenCount} tokens)`)

  // Generate TASKS.md
  const tasksMd = generateTasksMd(memory.name)
  await writeTasks(projectRoot, tasksMd)
  logger.success('TASKS.md created')

  // Write config and state
  const config = defaultConfig(projectRoot)
  if (options.hooks) config.hooksEnabled = true
  await writeConfig(projectRoot, config)

  const keyFiles = [
    path.join(projectRoot, 'package.json'),
    path.join(projectRoot, 'tsconfig.json'),
    path.join(projectRoot, 'prisma/schema.prisma'),
  ]
  const hashes = await buildFileHashes(projectRoot, keyFiles)
  await writeState(projectRoot, {
    lastScan: new Date().toISOString(),
    fileHashes: hashes,
    tokenCount,
    detectedLanguage: memory.stack.language,
    version: '1.0.0',
  })

  // Write .mcp.json
  const mcpConfig = {
    mcpServers: {
      dream: {
        type: 'stdio',
        command: 'dream',
        args: ['mcp'],
      },
    },
  }

  const mcpPath = mcpJsonPath(projectRoot)
  const existingMcp = await fs.readFile(mcpPath, 'utf-8').catch(() => null)
  if (existingMcp) {
    try {
      const parsed = JSON.parse(existingMcp)
      parsed.mcpServers = { ...parsed.mcpServers, dream: mcpConfig.mcpServers.dream }
      await fs.writeFile(mcpPath, JSON.stringify(parsed, null, 2) + '\n', 'utf-8')
    } catch {
      await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2) + '\n', 'utf-8')
    }
  } else {
    await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2) + '\n', 'utf-8')
  }
  logger.success('.mcp.json configured')

  // Optional git hooks
  if (options.hooks) {
    await installGitHooks(projectRoot)
  }

  // Install /dream slash command silently
  await installCommandCommand({ global: true }).catch(() => {})

  // Auto-sync to Obsidian if connected
  const currentConfig = await readConfig(projectRoot).catch(() => null)
  if (currentConfig?.obsidian?.enabled && currentConfig.obsidian.vaultPath) {
    const obsResult = await syncToObsidian(projectRoot, currentConfig.obsidian.vaultPath, currentConfig.obsidian.folder ?? 'Dream').catch(() => null)
    if (obsResult?.success) logger.success('Synced to Obsidian')
  }

  // Print summary
  console.log(chalk.bold.cyan('\n  ◆ Dream initialized successfully\n'))

  const stackParts = [
    memory.stack.language,
    memory.stack.frontend,
    memory.stack.backend,
    memory.stack.database,
  ].filter(Boolean)

  console.log(chalk.dim('  Detected stack: ') + chalk.white(stackParts.join(' · ')))
  console.log(chalk.dim('  Memory tokens:  ') + chalk.white(`~${tokenCount}`))
  console.log(chalk.dim('  Files created:  ') + chalk.white('CLAUDE.md, TASKS.md, .mcp.json, .dream/'))
  console.log()
  console.log(chalk.dim('  Claude Code will now load your project memory automatically.'))
  console.log(chalk.dim('  Run ') + chalk.white('dream status') + chalk.dim(' to verify. Run ') + chalk.white('dream scan') + chalk.dim(' to refresh.\n'))
}

async function installGitHooks(projectRoot: string) {
  const hooksDir = path.join(projectRoot, '.git', 'hooks')
  try {
    await fs.access(hooksDir)
    const hookPath = path.join(hooksDir, 'post-commit')
    const hookContent = `#!/bin/sh\ndream update 2>/dev/null &\n`
    await fs.writeFile(hookPath, hookContent, { mode: 0o755 })
    logger.success('Git post-commit hook installed')
  } catch {
    logger.warn('Could not install git hooks (not a git repo or no .git/hooks)')
  }
}
