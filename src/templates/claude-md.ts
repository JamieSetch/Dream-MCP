import type { ProjectMemory } from '../memory/schema.js'
import { memoryFromProjectMemory } from '../memory/manager.js'
import { trimToTokenBudget, estimateTokens } from '../utils/tokens.js'
import { renderSections } from '../memory/diff.js'
import type { UserPreferences } from '../preferences/schema.js'
import { renderPreferencesSection, renderAsClaudeInstructions } from '../preferences/renderer.js'

export function generateClaudeMd(memory: ProjectMemory, tokenBudget = 1500, preferences?: UserPreferences): string {
  const sections = memoryFromProjectMemory(memory)

  // Inject preferences into HOW CLAUDE SHOULD OPERATE if we have strong ones
  if (preferences && preferences.entries.length > 0) {
    const prefInstructions = renderAsClaudeInstructions(preferences)

    if (prefInstructions.length > 0) {
      const existing = sections.get('HOW CLAUDE SHOULD OPERATE') ?? ''
      const existingLines = existing.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2))
      const merged = [...new Set([...prefInstructions, ...existingLines])]
      sections.set('HOW CLAUDE SHOULD OPERATE', merged.map((i) => `- ${i}`).join('\n'))
    }

    // Add dedicated preferences section (after CONVENTIONS, before CURRENT FEATURES)
    const prefsSection = renderPreferencesSection(preferences)
    if (prefsSection) {
      sections.set('CLAUDE PREFERENCES', prefsSection)
    }
  }

  const trimmed = trimToTokenBudget(sections, tokenBudget)
  return renderSections(trimmed)
}

export function getTokenCount(content: string): number {
  return estimateTokens(content)
}
