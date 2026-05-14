import fs from 'fs/promises'
import path from 'path'
import { readMemory, readTasks } from '../memory/manager.js'
import { readPreferences } from '../preferences/manager.js'
import { formatProjectNote } from './formatter.js'

export interface SyncResult {
  success: boolean
  message: string
  notePath?: string
}

export async function syncToObsidian(
  projectRoot: string,
  vaultPath: string,
  folder = 'Dream',
): Promise<SyncResult> {
  const [memory, tasks, prefs] = await Promise.all([
    readMemory(projectRoot),
    readTasks(projectRoot),
    readPreferences(projectRoot),
  ])

  if (!memory) {
    return { success: false, message: 'No CLAUDE.md found — run `dream init` first' }
  }

  // Ensure Dream folder exists in vault
  const dreamFolder = path.join(vaultPath, folder)
  await fs.mkdir(dreamFolder, { recursive: true })

  const projectName = path.basename(projectRoot)
  const notePath = path.join(dreamFolder, `${projectName}.md`)

  const noteContent = formatProjectNote({
    projectName,
    memory,
    tasks,
    preferences: prefs,
    projectRoot,
  })

  await fs.writeFile(notePath, noteContent, 'utf-8')

  return {
    success: true,
    message: `Synced to Obsidian: ${folder}/${projectName}.md`,
    notePath,
  }
}

export async function removeFromObsidian(
  projectRoot: string,
  vaultPath: string,
  folder = 'Dream',
): Promise<void> {
  const projectName = path.basename(projectRoot)
  const notePath = path.join(vaultPath, folder, `${projectName}.md`)
  await fs.unlink(notePath).catch(() => {})
}
