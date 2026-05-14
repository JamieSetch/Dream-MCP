import chalk from 'chalk'
import ora from 'ora'
import { findProjectRoot } from '../../utils/paths.js'
import { readState, writeState } from '../../utils/state.js'
import { getRecentChangesFromGit } from '../../git/analyzer.js'
import { appendRecentChange, readMemory, ensureDreamDir } from '../../memory/manager.js'
import { logger } from '../../utils/logger.js'
import { estimateTokens } from '../../utils/tokens.js'

interface UpdateOptions {
  quiet?: boolean
}

export async function updateCommand(options: UpdateOptions = {}) {
  const projectRoot = await findProjectRoot()

  if (!options.quiet) {
    console.log(chalk.bold.cyan('\n  ◆ Dream — Incremental update\n'))
  }

  await ensureDreamDir(projectRoot)

  const memory = await readMemory(projectRoot)
  if (!memory) {
    logger.warn('No CLAUDE.md found. Run `dream init` first.')
    return
  }

  const state = await readState(projectRoot)

  const spinner = ora({ text: 'Fetching recent git changes...', color: 'cyan' }).start()

  try {
    const since = state.lastScan ? state.lastScan.slice(0, 10) : undefined
    const changes = await getRecentChangesFromGit(projectRoot, since)

    if (changes.length > 0) {
      spinner.succeed(`Found ${changes.reduce((sum, c) => sum + c.items.length, 0)} git commits since last scan`)

      for (const { date, items } of changes) {
        await appendRecentChange(projectRoot, items.map((i) => i))
      }

      logger.success('RECENT CHANGES updated')
    } else {
      spinner.succeed('No new git commits since last scan')
    }
  } catch {
    spinner.warn('Git analysis skipped')
  }

  // Update state timestamp
  const updatedMemory = await readMemory(projectRoot)
  await writeState(projectRoot, {
    ...state,
    lastScan: new Date().toISOString(),
    tokenCount: updatedMemory ? estimateTokens(updatedMemory) : state.tokenCount,
  })

  if (!options.quiet) {
    console.log()
    logger.success('Memory updated')
    console.log()
  }
}
