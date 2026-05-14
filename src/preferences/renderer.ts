import type { UserPreferences, PreferenceEntry } from './schema.js'
import { groupPreferencesByCategory } from './manager.js'

const CATEGORY_LABELS: Record<string, string> = {
  'response-style': 'Response Style',
  'code-style': 'Code Style',
  'workflow': 'Workflow',
  'communication': 'Communication',
  'custom': 'Other Preferences',
}

export function renderPreferencesSection(prefs: UserPreferences): string {
  if (prefs.entries.length === 0) return ''

  const grouped = groupPreferencesByCategory(prefs)
  const lines: string[] = []

  const sessionCount = prefs.totalObservations
  lines.push(`_Auto-learned from ${sessionCount} observation${sessionCount !== 1 ? 's' : ''}. Last updated: ${prefs.lastUpdated.slice(0, 10)}_`)
  lines.push('')

  const categoryOrder = ['response-style', 'code-style', 'workflow', 'communication', 'custom']

  for (const cat of categoryOrder) {
    const entries = grouped.get(cat)
    if (!entries || entries.length === 0) continue

    lines.push(`## ${CATEGORY_LABELS[cat] ?? cat}`)

    for (const entry of entries) {
      const strengthNote = entry.strength === 'high' ? '' : entry.strength === 'medium' ? ' _(developing)_' : ' _(weak signal)_'
      lines.push(`- ${entry.value}${strengthNote}`)
    }

    lines.push('')
  }

  return lines.join('\n').trim()
}

export function renderAsClaudeInstructions(prefs: UserPreferences): string[] {
  if (prefs.entries.length === 0) return []

  // Only include medium+ strength preferences as hard instructions
  const strong = prefs.entries
    .filter((e) => e.strength === 'high' || e.strength === 'medium')
    .sort((a, b) => b.count - a.count)

  return strong.map((e) => e.value)
}

export function generatePreferencesMd(prefs: UserPreferences, projectName: string): string {
  const grouped = groupPreferencesByCategory(prefs)
  const lines: string[] = [
    `# PREFERENCES — ${projectName}`,
    '',
    `> Auto-learned from ${prefs.totalObservations} observation${prefs.totalObservations !== 1 ? 's' : ''} across Claude sessions.`,
    `> Managed by Dream. Update with \`dream preferences set\` or let Claude observe naturally.`,
    `> Last updated: ${prefs.lastUpdated.slice(0, 10)}`,
    '',
  ]

  const categoryOrder = ['response-style', 'code-style', 'workflow', 'communication', 'custom']

  for (const cat of categoryOrder) {
    const entries = grouped.get(cat)
    if (!entries || entries.length === 0) continue

    lines.push(`## ${CATEGORY_LABELS[cat] ?? cat}`)
    lines.push('')

    for (const entry of entries) {
      const bar = '█'.repeat(Math.min(entry.count, 10)) + '░'.repeat(Math.max(0, 10 - entry.count))
      lines.push(`| ${entry.key} | ${entry.value} | ${bar} (${entry.count}x) | ${entry.source} |`)
    }

    lines.push('')
  }

  return lines.join('\n')
}
