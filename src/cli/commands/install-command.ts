import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import chalk from 'chalk'
import { findProjectRoot } from '../../utils/paths.js'
import { logger } from '../../utils/logger.js'
import { DREAM_SLASH_COMMAND, DREAM_SLASH_COMMAND_FILENAME } from '../../templates/slash-command.js'

interface InstallCommandOptions {
  global?: boolean
}

export async function installCommandCommand(options: InstallCommandOptions = {}) {
  console.log(chalk.bold.cyan('\n  ◆ Dream — Install /dream slash command\n'))

  const targets: Array<{ dir: string; label: string }> = []

  if (options.global) {
    targets.push({
      dir: path.join(os.homedir(), '.claude', 'commands'),
      label: 'global (~/.claude/commands/)',
    })
  } else {
    const projectRoot = await findProjectRoot()
    targets.push({
      dir: path.join(projectRoot, '.claude', 'commands'),
      label: 'project (.claude/commands/)',
    })
  }

  // If neither flag given, install both
  if (!options.global) {
    targets.push({
      dir: path.join(os.homedir(), '.claude', 'commands'),
      label: 'global (~/.claude/commands/)',
    })
  }

  for (const { dir, label } of targets) {
    await fs.mkdir(dir, { recursive: true })
    const dest = path.join(dir, DREAM_SLASH_COMMAND_FILENAME)
    await fs.writeFile(dest, DREAM_SLASH_COMMAND, 'utf-8')
    logger.success(`Installed to ${label}`)
  }

  console.log()
  console.log(chalk.bold.white('  How to use:'))
  console.log()
  console.log(chalk.dim('  At the end of any Claude Code session, type:'))
  console.log()
  console.log('  ' + chalk.bold.cyan('/dream'))
  console.log()
  console.log(chalk.dim('  Claude will:'))
  console.log(chalk.dim('  · Update CURRENT TASK with where you left off'))
  console.log(chalk.dim('  · Log everything built or changed this session'))
  console.log(chalk.dim('  · Save any preferences it observed'))
  console.log(chalk.dim('  · Flag open issues'))
  console.log(chalk.dim('  · Rescan if architecture changed'))
  console.log()
  console.log(chalk.dim('  Next session opens → Claude already knows everything.\n'))
}
