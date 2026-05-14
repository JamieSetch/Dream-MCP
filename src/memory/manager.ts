import fs from 'fs/promises'
import path from 'path'
import { claudeMdPath, tasksMdPath, dreamDir } from '../utils/paths.js'
import { parseSections, renderSections, updateSection } from './diff.js'
import type { ProjectMemory } from './schema.js'

const writeQueues = new Map<string, Promise<void>>()

function withWriteLock(projectRoot: string, fn: () => Promise<void>): Promise<void> {
  const prev = writeQueues.get(projectRoot) ?? Promise.resolve()
  const next = prev.then(fn)
  writeQueues.set(projectRoot, next.catch(() => {}))
  return next
}

async function writeDirect(projectRoot: string, content: string): Promise<void> {
  const tmpPath = path.join(dreamDir(projectRoot), `CLAUDE.md.${process.pid}.tmp`)
  const destPath = claudeMdPath(projectRoot)
  await fs.mkdir(dreamDir(projectRoot), { recursive: true })
  await fs.writeFile(tmpPath, content, 'utf-8')
  await fs.rename(tmpPath, destPath)
}

export async function readMemory(projectRoot: string): Promise<string | null> {
  try {
    return await fs.readFile(claudeMdPath(projectRoot), 'utf-8')
  } catch {
    return null
  }
}

export async function writeMemory(projectRoot: string, content: string): Promise<void> {
  return withWriteLock(projectRoot, () => writeDirect(projectRoot, content))
}

export async function readTasks(projectRoot: string): Promise<string | null> {
  try {
    return await fs.readFile(tasksMdPath(projectRoot), 'utf-8')
  } catch {
    return null
  }
}

export async function writeTasks(projectRoot: string, content: string): Promise<void> {
  await fs.writeFile(tasksMdPath(projectRoot), content, 'utf-8')
}

export async function updateMemorySection(projectRoot: string, sectionName: string, content: string): Promise<void> {
  return withWriteLock(projectRoot, async () => {
    const existing = await readMemory(projectRoot)
    if (!existing) return
    await writeDirect(projectRoot, updateSection(existing, sectionName, content))
  })
}

export async function updateCurrentTask(projectRoot: string, task: string): Promise<void> {
  return updateMemorySection(projectRoot, 'CURRENT TASK', task)
}

export async function addOpenIssue(projectRoot: string, issue: string): Promise<void> {
  return withWriteLock(projectRoot, async () => {
    const content = await readMemory(projectRoot)
    if (!content) return
    const sections = parseSections(content)
    const existing = sections.get('OPEN ISSUES') ?? ''
    sections.set('OPEN ISSUES', existing ? existing + '\n- ' + issue : '- ' + issue)
    await writeDirect(projectRoot, renderSections(sections))
  })
}

export async function resolveIssue(projectRoot: string, issueText: string): Promise<boolean> {
  let resolved = false
  await withWriteLock(projectRoot, async () => {
    const content = await readMemory(projectRoot)
    if (!content) return
    const sections = parseSections(content)
    const existing = sections.get('OPEN ISSUES') ?? ''
    const lines = existing.split('\n')
    const filtered = lines.filter((l) => !l.toLowerCase().includes(issueText.toLowerCase()))
    if (filtered.length === lines.length) return
    sections.set('OPEN ISSUES', filtered.join('\n'))
    await writeDirect(projectRoot, renderSections(sections))
    resolved = true
  })
  return resolved
}

export async function appendRecentChange(projectRoot: string, items: string[]): Promise<void> {
  return withWriteLock(projectRoot, async () => {
    const content = await readMemory(projectRoot)
    if (!content) return
    const sections = parseSections(content)
    const today = new Date().toISOString().slice(0, 10)
    const newBlock = `${today}\n${items.map((i) => `- ${i}`).join('\n')}`
    const existing = sections.get('RECENT CHANGES') ?? ''
    sections.set('RECENT CHANGES', newBlock + (existing ? '\n\n' + existing : ''))
    await writeDirect(projectRoot, renderSections(sections))
  })
}

export async function ensureDreamDir(projectRoot: string): Promise<void> {
  await fs.mkdir(dreamDir(projectRoot), { recursive: true })
}

export function memoryFromProjectMemory(mem: ProjectMemory): Map<string, string> {
  const sections = new Map<string, string>()

  sections.set('PROJECT', [`Name: ${mem.name}`, `Purpose: ${mem.purpose}`, `Stage: ${mem.stage}`].join('\n'))

  const stackLines: string[] = []
  if (mem.stack.language) stackLines.push(`Language: ${mem.stack.language}`)
  if (mem.stack.runtime && mem.stack.runtime !== 'node') stackLines.push(`Runtime: ${mem.stack.runtime}`)
  if (mem.stack.frontend) stackLines.push(`Frontend: ${mem.stack.frontend}`)
  if (mem.stack.backend) stackLines.push(`Backend: ${mem.stack.backend}`)
  if (mem.stack.database) stackLines.push(`Database: ${mem.stack.database}${mem.stack.orm ? ` (${mem.stack.orm})` : ''}`)
  if (mem.stack.auth) stackLines.push(`Auth: ${mem.stack.auth}`)
  if (mem.stack.styling) stackLines.push(`Styling: ${mem.stack.styling}`)
  if (mem.stack.testing) stackLines.push(`Testing: ${mem.stack.testing}`)
  if (mem.stack.infra) stackLines.push(`Infra: ${mem.stack.infra}`)
  if (mem.stack.packageManager) stackLines.push(`Package Manager: ${mem.stack.packageManager}`)
  if (stackLines.length > 0) sections.set('STACK', stackLines.join('\n'))

  if (mem.architecture.length > 0) sections.set('ARCHITECTURE', mem.architecture.map((a) => `- ${a}`).join('\n'))

  const topFolders = Object.entries(mem.folderStructure).slice(0, 12)
  if (topFolders.length > 0) {
    sections.set('FOLDER STRUCTURE', topFolders.map(([k, v]) => `${k} — ${v}`).join('\n'))
  }

  if (mem.conventions.length > 0) sections.set('CONVENTIONS', mem.conventions.map((c) => `- ${c}`).join('\n'))
  if (mem.features.length > 0) sections.set('CURRENT FEATURES', mem.features.map((f) => `- ${f}`).join('\n'))
  if (mem.currentTask) sections.set('CURRENT TASK', mem.currentTask)
  if (mem.openIssues.length > 0) sections.set('OPEN ISSUES', mem.openIssues.map((i) => `- ${i}`).join('\n'))

  if (mem.recentChanges.length > 0) {
    const rcLines = mem.recentChanges.map((rc) => `${rc.date}\n${rc.items.map((i) => `- ${i}`).join('\n')}`).join('\n\n')
    sections.set('RECENT CHANGES', rcLines)
  }

  if (mem.claudeInstructions.length > 0) {
    sections.set('HOW CLAUDE SHOULD OPERATE', mem.claudeInstructions.map((i) => `- ${i}`).join('\n'))
  }

  return sections
}
