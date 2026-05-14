import { parseSections } from '../memory/diff.js'
import type { UserPreferences } from '../preferences/schema.js'
import { groupPreferencesByCategory } from '../preferences/manager.js'

export interface ObsidianNoteOptions {
  projectName: string
  memory: string
  tasks: string | null
  preferences: UserPreferences | null
  projectRoot: string
}

export function formatProjectNote(opts: ObsidianNoteOptions): string {
  const { projectName, memory, tasks, preferences } = opts
  const today = new Date().toISOString().slice(0, 10)
  const sections = parseSections(memory)

  const stackSection = sections.get('STACK') ?? ''
  const stackLines = stackSection.split('\n').filter(Boolean)
  const frontmatterStack = stackLines.slice(0, 3).map((l) => {
    const [k, v] = l.split(': ')
    return `  - "${v?.trim() ?? l}"`
  }).join('\n')

  const tags = buildTags(sections, preferences)

  const frontmatter = `---
title: ${projectName}
tags:
${tags.map((t) => `  - ${t}`).join('\n')}
stack:
${frontmatterStack}
last_synced: "${today}"
source: dream-mcp
---`

  const parts: string[] = [frontmatter, '', `# ${projectName}`, '']

  // Project overview
  const project = sections.get('PROJECT')
  if (project) {
    parts.push('## Overview', '')
    for (const line of project.split('\n').filter(Boolean)) {
      parts.push(line)
    }
    parts.push('')
  }

  // Stack as a table
  if (stackSection) {
    parts.push('## Tech Stack', '')
    parts.push('| Layer | Technology |')
    parts.push('|-------|-----------|')
    for (const line of stackLines) {
      const colonIdx = line.indexOf(': ')
      if (colonIdx !== -1) {
        const k = line.slice(0, colonIdx).trim()
        const v = line.slice(colonIdx + 2).trim()
        parts.push(`| ${k} | ${v} |`)
      }
    }
    parts.push('')
  }

  // Architecture
  const arch = sections.get('ARCHITECTURE')
  if (arch) {
    parts.push('## Architecture', '')
    for (const line of arch.split('\n').filter(Boolean)) parts.push(line)
    parts.push('')
  }

  // Current Task — highlighted
  const currentTask = sections.get('CURRENT TASK')
  if (currentTask) {
    parts.push('## Current Task', '')
    parts.push(`> [!info] Active Work`)
    parts.push(`> ${currentTask}`)
    parts.push('')
  }

  // Open Issues as checkboxes
  const issues = sections.get('OPEN ISSUES')
  if (issues) {
    parts.push('## Open Issues', '')
    for (const line of issues.split('\n').filter(Boolean)) {
      const item = line.startsWith('- ') ? line.slice(2) : line
      parts.push(`- [ ] ${item}`)
    }
    parts.push('')
  }

  // Recent Changes as a timeline
  const recentChanges = sections.get('RECENT CHANGES')
  if (recentChanges) {
    parts.push('## Recent Changes', '')
    const blocks = recentChanges.split(/\n(?=\d{4}-\d{2}-\d{2})/)
    for (const block of blocks) {
      const lines = block.trim().split('\n')
      const date = lines[0]
      if (date) {
        parts.push(`**${date}**`)
        for (const line of lines.slice(1)) {
          if (line.trim()) parts.push(line)
        }
        parts.push('')
      }
    }
  }

  // Conventions
  const conventions = sections.get('CONVENTIONS')
  if (conventions) {
    parts.push('## Conventions', '')
    for (const line of conventions.split('\n').filter(Boolean)) parts.push(line)
    parts.push('')
  }

  // Preferences
  if (preferences && preferences.entries.length > 0) {
    parts.push('## Claude Preferences', '')
    parts.push('_Preferences auto-learned across sessions_', '')
    const grouped = groupPreferencesByCategory(preferences)
    for (const [cat, entries] of grouped) {
      parts.push(`**${cat}**`)
      for (const e of entries.slice(0, 5)) {
        parts.push(`- ${e.value} _(${e.count}x observed)_`)
      }
      parts.push('')
    }
  }

  // Tasks section
  if (tasks) {
    parts.push('---', '', '## Tasks', '')
    const taskLines = tasks.split('\n').filter((l) => !l.startsWith('_') && !l.startsWith('---'))
    parts.push(...taskLines.slice(1)) // skip the # TASKS heading
    parts.push('')
  }

  // Footer
  parts.push('---')
  parts.push(`_Synced by [Dream MCP](https://github.com/dream-mcp/dream) on ${today}_`)

  return parts.join('\n')
}

function buildTags(sections: Map<string, string>, prefs: UserPreferences | null): string[] {
  const tags = ['dream', 'project']

  const stack = sections.get('STACK') ?? ''
  if (stack.toLowerCase().includes('next.js')) tags.push('nextjs')
  if (stack.toLowerCase().includes('react')) tags.push('react')
  if (stack.toLowerCase().includes('typescript')) tags.push('typescript')
  if (stack.toLowerCase().includes('python')) tags.push('python')
  if (stack.toLowerCase().includes('prisma')) tags.push('prisma')

  const stage = sections.get('PROJECT') ?? ''
  if (stage.includes('production')) tags.push('production')
  else if (stage.includes('prototype')) tags.push('prototype')
  else tags.push('development')

  return tags
}
