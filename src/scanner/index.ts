import path from 'path'
import {
  scanPackageJson,
  scanPythonProject,
  scanGoProject,
  scanRustProject,
} from './package-scanner.js'
import { scanFileSystem, sampleSourceFiles } from './file-scanner.js'
import {
  detectJsTsStack,
  detectPythonStack,
  detectGoStack,
  inferArchitecture,
} from './stack-detector.js'
import { detectConventions } from './convention-detector.js'
import type { ProjectMemory } from '../memory/schema.js'

export interface ScanResult {
  memory: Omit<ProjectMemory, 'currentTask' | 'openIssues' | 'recentChanges' | 'claudeInstructions'>
  language: string
  rawStack: Record<string, string | undefined>
}

export async function scanRepository(projectRoot: string): Promise<ProjectMemory> {
  const [pkg, python, go, rust, fs_info] = await Promise.all([
    scanPackageJson(projectRoot),
    scanPythonProject(projectRoot),
    scanGoProject(projectRoot),
    scanRustProject(projectRoot),
    scanFileSystem(projectRoot),
  ])

  // Determine primary language and project name
  let projectName = path.basename(projectRoot)
  let partialStack: Partial<import('../memory/schema.js').ProjectStack> = {}
  let language = 'Unknown'

  if (pkg) {
    partialStack = await detectJsTsStack(projectRoot, pkg)
    language = pkg.language
    projectName = pkg.name || projectName
  } else if (python) {
    partialStack = detectPythonStack(python)
    language = 'Python'
    projectName = python.name || projectName
  } else if (go) {
    partialStack = detectGoStack(go)
    language = 'Go'
    projectName = go.moduleName.split('/').pop() || projectName
  } else if (rust) {
    partialStack = { language: 'Rust', runtime: 'node' }
    projectName = rust.name || projectName
  }

  const [sourceFiles, architecture] = await Promise.all([
    sampleSourceFiles(projectRoot),
    inferArchitecture(projectRoot, partialStack),
  ])

  const conventions = await detectConventions(projectRoot, sourceFiles)

  // Infer purpose from README + project name
  const purpose = inferPurpose(fs_info.readme, projectName, pkg?.description ?? python?.description ?? '')

  // Infer features from directory structure
  const features = inferFeatures(fs_info.topLevelDirs, fs_info.folderStructure)

  // Infer project stage
  const stage = inferStage(pkg, fs_info)

  // Build instructions
  const claudeInstructions = buildInstructions(partialStack, conventions)

  const stack: ProjectMemory['stack'] = {
    runtime: partialStack.runtime ?? 'node',
    language: partialStack.language ?? language,
    frontend: partialStack.frontend,
    backend: partialStack.backend,
    database: partialStack.database,
    orm: partialStack.orm,
    auth: partialStack.auth,
    styling: partialStack.styling,
    testing: partialStack.testing,
    infra: partialStack.infra,
    packageManager: partialStack.packageManager,
    buildTool: partialStack.buildTool,
  }

  return {
    name: projectName,
    purpose,
    stage,
    stack,
    architecture,
    folderStructure: fs_info.folderStructure,
    conventions,
    features,
    openIssues: [],
    recentChanges: [],
    claudeInstructions,
    scannedAt: new Date().toISOString(),
  }
}

function inferPurpose(readme: string, name: string, description: string): string {
  if (description) return description

  // Extract first meaningful line from README
  const lines = readme.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !l.startsWith('!') && l.length > 20)
  if (lines.length > 0) return lines[0].slice(0, 120)

  // Extract from H1 and first paragraph
  const h1 = readme.match(/^#\s+(.+)/m)
  if (h1) return h1[1].trim()

  return `${name} application`
}

function inferFeatures(dirs: string[], structure: Record<string, string>): string[] {
  const features: string[] = []
  const dirSet = new Set(dirs)

  if (dirSet.has('app') || dirSet.has('pages')) features.push('Web application routing')
  if (dirSet.has('api') || structure['src/api/']) features.push('REST API endpoints')
  if (structure['src/trpc/'] || dirs.some((d) => d.includes('trpc'))) features.push('tRPC API layer')
  if (dirSet.has('prisma') || dirSet.has('drizzle')) features.push('Database ORM')
  if (dirSet.has('migrations')) features.push('Database migrations')
  if (dirSet.has('emails')) features.push('Transactional emails')
  if (dirSet.has('workers') || dirSet.has('jobs')) features.push('Background jobs')
  if (dirSet.has('i18n') || dirSet.has('locales')) features.push('Internationalization')
  if (dirs.some((d) => d.includes('auth') || d.includes('login'))) features.push('Authentication')
  if (dirs.some((d) => d.includes('dashboard'))) features.push('Dashboard')
  if (dirs.some((d) => d.includes('billing') || d.includes('subscription'))) features.push('Billing / subscriptions')
  if (dirs.some((d) => d.includes('admin'))) features.push('Admin panel')
  if (dirs.some((d) => d.includes('blog') || d.includes('content'))) features.push('Content / blog')
  if (dirSet.has('e2e') || dirSet.has('__tests__')) features.push('Automated test suite')

  return features.slice(0, 10)
}

function inferStage(pkg: Awaited<ReturnType<typeof scanPackageJson>>, _fs: { keyFiles: string[] }): ProjectMemory['stage'] {
  if (!pkg) return 'development'
  const v = pkg.version ?? '0.0.0'
  if (v.startsWith('0.0.')) return 'prototype'
  if (v.startsWith('0.')) return 'development'
  return 'development'
}

function buildInstructions(stack: Partial<import('../memory/schema.js').ProjectStack>, conventions: string[]): string[] {
  const instructions: string[] = [
    'Preserve existing architecture patterns and folder structure',
    'Avoid introducing duplicate logic — check existing utilities first',
  ]

  if (stack.language === 'TypeScript') instructions.push('Maintain strict typing — no implicit any')
  if (conventions.some((c) => c.includes('Named exports'))) instructions.push('Use named exports, not default exports')
  if (stack.orm) instructions.push(`Use ${stack.orm} for all database operations`)
  if (stack.frontend?.includes('Next.js')) instructions.push('Prefer Server Components; use Client Components only when needed')

  instructions.push('Update CLAUDE.md after significant architectural changes')

  return instructions
}
