import ora from 'ora'
import chalk from 'chalk'
import { findProjectRoot } from '../../utils/paths.js'
import { scanRepository } from '../../scanner/index.js'
import { analyzeGit } from '../../git/analyzer.js'
import { summarizeRecentActivity } from '../../git/summarizer.js'
import { generateClaudeMd } from '../../templates/claude-md.js'
import { writeMemory, readMemory, ensureDreamDir } from '../../memory/manager.js'
import { parseSections, diffSections } from '../../memory/diff.js'
import { writeState, buildFileHashes } from '../../utils/state.js'
import { estimateTokens } from '../../utils/tokens.js'
import { logger } from '../../utils/logger.js'
import path from 'path'

interface ScanOptions {
  quiet?: boolean
}

export async function scanCommand(options: ScanOptions = {}) {
  const projectRoot = await findProjectRoot()

  if (!options.quiet) {
    console.log(chalk.bold.cyan('\n  ◆ Dream — Rescanning repository\n'))
  }

  await ensureDreamDir(projectRoot)

  // Read existing for diff
  const existingContent = await readMemory(projectRoot)
  const existingSections = existingContent ? parseSections(existingContent) : new Map()

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

  // Git history
  try {
    const git = await analyzeGit(projectRoot)
    const recentActivity = summarizeRecentActivity(git)
    if (recentActivity.length > 0) {
      memory.recentChanges = recentActivity
    }
  } catch {}

  // Preserve manually edited sections
  if (existingContent) {
    if (existingSections.has('CURRENT TASK') && existingSections.get('CURRENT TASK')) {
      memory.currentTask = existingSections.get('CURRENT TASK')
    }
    if (existingSections.has('OPEN ISSUES') && existingSections.get('OPEN ISSUES')) {
      const issues = existingSections.get('OPEN ISSUES')!
        .split('\n')
        .filter((l: string) => l.startsWith('- '))
        .map((l: string) => l.slice(2).trim())
      memory.openIssues = issues
    }
  }

  const content = generateClaudeMd(memory)
  const tokenCount = estimateTokens(content)
  await writeMemory(projectRoot, content)

  // Update state
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

  if (!options.quiet) {
    // Show diff
    const newSections = parseSections(content)
    const { added, removed, changed } = diffSections(existingSections, newSections)

    if (added.length > 0) logger.success(`Sections added: ${added.join(', ')}`)
    if (changed.length > 0) logger.info(`Sections updated: ${changed.join(', ')}`)
    if (removed.length > 0) logger.warn(`Sections removed: ${removed.join(', ')}`)
    if (added.length === 0 && changed.length === 0 && removed.length === 0) {
      logger.info('No section changes detected')
    }

    console.log()
    console.log(chalk.dim('  Memory updated: ') + chalk.white(`~${tokenCount} tokens`))
    console.log()
  }
}
