import path from 'path'

export type ChangeType =
  | 'schema'      // prisma/drizzle schema changes
  | 'package'     // package.json changes
  | 'config'      // tsconfig, build config
  | 'api'         // API route changes
  | 'feature'     // new source files
  | 'env'         // environment config
  | 'style'       // UI/styling changes
  | 'test'        // test files
  | 'minor'       // other changes

export interface ClassifiedChange {
  file: string
  type: ChangeType
  event: 'add' | 'change' | 'unlink'
}

export function classifyChange(filePath: string, event: 'add' | 'change' | 'unlink'): ClassifiedChange {
  const rel = filePath.replace(/\\/g, '/')
  const basename = path.basename(rel)
  const lower = rel.toLowerCase()

  let type: ChangeType = 'minor'

  if (lower.includes('prisma/schema') || lower.includes('drizzle') && lower.endsWith('.ts') || lower.includes('schema.sql')) {
    type = 'schema'
  } else if (basename === 'package.json' && !lower.includes('node_modules')) {
    type = 'package'
  } else if (
    basename === 'tsconfig.json' ||
    basename === 'tsup.config.ts' ||
    basename === 'vite.config.ts' ||
    basename === 'next.config.ts' ||
    basename === 'next.config.js' ||
    basename === 'tailwind.config.ts' ||
    basename === 'tailwind.config.js'
  ) {
    type = 'config'
  } else if (
    lower.includes('/api/') ||
    lower.includes('/routes/') ||
    lower.includes('/server/') ||
    lower.includes('/trpc/')
  ) {
    type = 'api'
  } else if (basename === '.env.example' || basename === '.env.sample') {
    type = 'env'
  } else if (lower.includes('.test.') || lower.includes('.spec.') || lower.includes('__tests__')) {
    type = 'test'
  } else if (lower.includes('/styles/') || lower.includes('/css/') || basename.endsWith('.css')) {
    type = 'style'
  } else if (event === 'add' && /\.(ts|tsx|js|jsx|py|go|rs)$/.test(basename)) {
    type = 'feature'
  }

  return { file: rel, type, event }
}

export function shouldTriggerUpdate(changes: ClassifiedChange[]): boolean {
  const significant: ChangeType[] = ['schema', 'package', 'config', 'api', 'feature', 'env']
  return changes.some((c) => significant.includes(c.type))
}

export function summarizeChanges(changes: ClassifiedChange[]): string[] {
  const summary: string[] = []
  const byType = new Map<ChangeType, ClassifiedChange[]>()

  for (const change of changes) {
    if (!byType.has(change.type)) byType.set(change.type, [])
    byType.get(change.type)!.push(change)
  }

  if (byType.has('schema')) summary.push('Updated database schema')
  if (byType.has('package')) summary.push('Updated dependencies')
  if (byType.has('config')) summary.push('Updated project configuration')
  if (byType.has('env')) summary.push('Updated environment configuration')

  const apiChanges = byType.get('api') ?? []
  if (apiChanges.length > 0) {
    const files = apiChanges.map((c) => path.basename(c.file)).slice(0, 3).join(', ')
    summary.push(`Modified API routes: ${files}`)
  }

  const featureChanges = byType.get('feature') ?? []
  if (featureChanges.length > 0) {
    summary.push(`Added ${featureChanges.length} new source file${featureChanges.length > 1 ? 's' : ''}`)
  }

  return summary
}
