export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export interface TrimOptions {
  budget: number
}

export function trimToTokenBudget(sections: Map<string, string>, budget: number): Map<string, string> {
  const PROTECTED = new Set(['PROJECT', 'STACK', 'ARCHITECTURE', 'CONVENTIONS', 'HOW CLAUDE SHOULD OPERATE'])

  const total = () =>
    Array.from(sections.values()).reduce((sum, v) => sum + estimateTokens(v), 0)

  if (total() <= budget) return sections

  // Trim RECENT CHANGES to last 5 entries
  if (sections.has('RECENT CHANGES')) {
    const rc = sections.get('RECENT CHANGES')!
    const blocks = rc.split(/\n(?=\d{4}-\d{2}-\d{2})/)
    if (blocks.length > 5) {
      sections.set('RECENT CHANGES', blocks.slice(-5).join('\n'))
    }
  }

  if (total() <= budget) return sections

  // Trim OPEN ISSUES to 5 items
  if (sections.has('OPEN ISSUES')) {
    const lines = sections.get('OPEN ISSUES')!.split('\n')
    const items = lines.filter((l) => l.startsWith('- '))
    if (items.length > 5) {
      sections.set('OPEN ISSUES', items.slice(0, 5).join('\n'))
    }
  }

  if (total() <= budget) return sections

  // Trim CURRENT FEATURES to 8 items
  if (sections.has('CURRENT FEATURES')) {
    const lines = sections.get('CURRENT FEATURES')!.split('\n')
    const items = lines.filter((l) => l.startsWith('- '))
    if (items.length > 8) {
      sections.set('CURRENT FEATURES', items.slice(0, 8).join('\n'))
    }
  }

  if (total() <= budget) return sections

  // Remove non-protected sections that are empty or minimal
  for (const [key] of sections) {
    if (!PROTECTED.has(key) && total() > budget) {
      const val = sections.get(key)!
      if (val.split('\n').length <= 3) sections.delete(key)
    }
  }

  return sections
}
