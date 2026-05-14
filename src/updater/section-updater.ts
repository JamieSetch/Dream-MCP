import { appendRecentChange } from '../memory/manager.js'
import { scanRepository } from '../scanner/index.js'
import { generateClaudeMd } from '../templates/claude-md.js'
import { writeMemory, readMemory } from '../memory/manager.js'
import { parseSections } from '../memory/diff.js'
import { getRecentChangesFromGit } from '../git/analyzer.js'
import { readPreferences } from '../preferences/manager.js'
import { readConfig } from '../utils/config.js'
import { syncToObsidian } from '../obsidian/syncer.js'
import type { ClassifiedChange } from './change-analyzer.js'

export async function performIncrementalUpdate(
  projectRoot: string,
  changes: ClassifiedChange[],
  changeSummaries: string[],
): Promise<void> {
  if (changeSummaries.length > 0) {
    await appendRecentChange(projectRoot, changeSummaries)
  }

  const needsStackUpdate = changes.some((c) => c.type === 'package' || c.type === 'schema')

  if (needsStackUpdate) {
    await performFullRescan(projectRoot)
  }
}

export async function performFullRescan(projectRoot: string): Promise<{ tokenCount: number }> {
  const [memory, prefs] = await Promise.all([
    scanRepository(projectRoot),
    readPreferences(projectRoot),
  ])

  // Pull git changes for recent history
  const gitChanges = await getRecentChangesFromGit(projectRoot)
  if (gitChanges.length > 0) {
    memory.recentChanges = gitChanges
  }

  // Preserve manually edited sections
  const existing = await readMemory(projectRoot)
  if (existing) {
    const existingSections = parseSections(existing)
    if (existingSections.has('CURRENT TASK') && existingSections.get('CURRENT TASK')) {
      memory.currentTask = existingSections.get('CURRENT TASK')
    }
    if (existingSections.has('OPEN ISSUES') && existingSections.get('OPEN ISSUES')) {
      const issueLines = existingSections.get('OPEN ISSUES')!.split('\n')
        .filter((l) => l.startsWith('- '))
        .map((l) => l.slice(2).trim())
      memory.openIssues = issueLines
    }
  }

  const content = generateClaudeMd(memory, 1500, prefs)
  await writeMemory(projectRoot, content)

  const tokenCount = Math.ceil(content.length / 4)

  // Auto-sync to Obsidian if configured
  const config = await readConfig(projectRoot).catch(() => null)
  if (config?.obsidian?.enabled && config.obsidian.autoSync && config.obsidian.vaultPath) {
    await syncToObsidian(projectRoot, config.obsidian.vaultPath, config.obsidian.folder ?? 'Dream').catch(() => {})
  }

  return { tokenCount }
}
