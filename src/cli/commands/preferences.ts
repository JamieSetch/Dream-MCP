import chalk from 'chalk'
import { findProjectRoot } from '../../utils/paths.js'
import { readPreferences, writePreferences, setPreference, removePreference, groupPreferencesByCategory } from '../../preferences/manager.js'
import { autoDetectPreferences } from '../../preferences/detector.js'
import { generatePreferencesMd } from '../../preferences/renderer.js'
import { PREFERENCE_CATEGORIES, type PreferenceCategory } from '../../preferences/schema.js'
import { logger } from '../../utils/logger.js'
import fs from 'fs/promises'
import path from 'path'
import { dreamDir } from '../../utils/paths.js'

export async function preferencesListCommand() {
  const projectRoot = await findProjectRoot()
  const prefs = await readPreferences(projectRoot)

  console.log(chalk.bold.cyan('\n  ◆ Dream — User Preferences\n'))

  if (prefs.entries.length === 0) {
    console.log(chalk.dim('  No preferences recorded yet.'))
    console.log(chalk.dim('  Claude will learn them automatically, or run `dream preferences learn`'))
    console.log()
    return
  }

  const grouped = groupPreferencesByCategory(prefs)
  const CATEGORY_LABELS: Record<string, string> = {
    'response-style': 'Response Style',
    'code-style': 'Code Style',
    'workflow': 'Workflow',
    'communication': 'Communication',
    'custom': 'Custom',
  }

  for (const [cat, entries] of grouped) {
    console.log(chalk.bold.white(`\n  ${CATEGORY_LABELS[cat] ?? cat}`))
    for (const e of entries) {
      const bar = strengthBar(e.count)
      const sourceColor = e.source === 'claude' ? chalk.cyan : e.source === 'manual' ? chalk.green : chalk.dim
      const src = sourceColor(`[${e.source}]`)
      console.log(`  ${bar} ${chalk.white(e.value)} ${src}`)
      console.log(chalk.dim(`       key: ${e.key} | seen: ${e.count}x | strength: ${e.strength}`))
    }
  }

  console.log()
  console.log(chalk.dim(`  Total: ${prefs.entries.length} preferences | ${prefs.totalObservations} observations`))
  console.log()
}

export async function preferencesSetCommand(key: string, value: string, category?: string) {
  const projectRoot = await findProjectRoot()

  const cat = (category ?? 'custom') as PreferenceCategory
  if (!PREFERENCE_CATEGORIES.includes(cat)) {
    logger.error(`Invalid category. Options: ${PREFERENCE_CATEGORIES.join(', ')}`)
    return
  }

  await setPreference(projectRoot, key, value, cat)
  logger.success(`Preference set: "${key}" → "${value}"`)
}

export async function preferencesRemoveCommand(key: string) {
  const projectRoot = await findProjectRoot()
  const removed = await removePreference(projectRoot, key)
  if (removed) {
    logger.success(`Preference removed: "${key}"`)
  } else {
    logger.warn(`No preference found with key: "${key}"`)
  }
}

export async function preferencesLearnCommand() {
  const projectRoot = await findProjectRoot()

  console.log(chalk.bold.cyan('\n  ◆ Dream — Learning preferences from codebase\n'))

  const spinner_text = 'Analyzing code patterns...'
  process.stderr.write(chalk.dim('  ') + chalk.cyan('⟳ ') + spinner_text + '\n')

  const count = await autoDetectPreferences(projectRoot)

  logger.success(`Detected ${count} preference signal${count !== 1 ? 's' : ''} from code + git history`)

  const prefs = await readPreferences(projectRoot)
  logger.dim(`Total preferences: ${prefs.entries.length} | Observations: ${prefs.totalObservations}`)
  console.log()
}

export async function preferencesClearCommand() {
  const projectRoot = await findProjectRoot()
  const prefs = await readPreferences(projectRoot)
  prefs.entries = []
  prefs.totalObservations = 0
  prefs.lastUpdated = new Date().toISOString()
  await writePreferences(projectRoot, prefs)
  logger.success('All preferences cleared')
}

export async function preferencesExportCommand() {
  const projectRoot = await findProjectRoot()
  const prefs = await readPreferences(projectRoot)
  const content = generatePreferencesMd(prefs, path.basename(projectRoot))

  const outPath = path.join(dreamDir(projectRoot), 'PREFERENCES.md')
  await fs.writeFile(outPath, content, 'utf-8')
  logger.success(`Exported to .dream/PREFERENCES.md`)
}

function strengthBar(count: number): string {
  const filled = Math.min(count, 5)
  const empty = 5 - filled
  const bar = chalk.green('●'.repeat(filled)) + chalk.dim('○'.repeat(empty))
  return bar
}
