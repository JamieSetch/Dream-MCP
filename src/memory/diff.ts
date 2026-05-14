export type Sections = Map<string, string>

const SECTION_REGEX = /^# (.+)$/gm

export function parseSections(content: string): Sections {
  const sections = new Map<string, string>()
  const matches = [...content.matchAll(SECTION_REGEX)]

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const name = match[1].trim()
    const start = (match.index ?? 0) + match[0].length
    const end = matches[i + 1]?.index ?? content.length
    const body = content.slice(start, end).trim()
    sections.set(name, body)
  }

  return sections
}

export function renderSections(sections: Sections): string {
  const parts: string[] = []
  for (const [name, body] of sections) {
    parts.push(`# ${name}`)
    if (body) parts.push(body)
    parts.push('')
  }
  return parts.join('\n').trim() + '\n'
}

export function updateSection(existing: string, sectionName: string, newContent: string): string {
  const sections = parseSections(existing)
  sections.set(sectionName, newContent)
  return renderSections(sections)
}

export function getSection(content: string, sectionName: string): string | undefined {
  return parseSections(content).get(sectionName)
}

export function mergeSections(base: Sections, updates: Sections): Sections {
  const merged = new Map(base)
  for (const [key, val] of updates) {
    merged.set(key, val)
  }
  return merged
}

export function diffSections(before: Sections, after: Sections): { added: string[]; removed: string[]; changed: string[] } {
  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []

  for (const [key, val] of after) {
    if (!before.has(key)) added.push(key)
    else if (before.get(key) !== val) changed.push(key)
  }

  for (const key of before.keys()) {
    if (!after.has(key)) removed.push(key)
  }

  return { added, removed, changed }
}
