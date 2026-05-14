import fs from 'fs/promises'
import path from 'path'
import { recordObservation } from './manager.js'
import type { ObservationInput } from './schema.js'

export async function autoDetectPreferences(projectRoot: string): Promise<number> {
  const observations: ObservationInput[] = []

  await Promise.all([
    detectFromSourceFiles(projectRoot, observations),
    detectFromGitHistory(projectRoot, observations),
    detectFromConfig(projectRoot, observations),
  ])

  let count = 0
  for (const obs of observations) {
    await recordObservation(projectRoot, obs)
    count++
  }

  return count
}

async function detectFromSourceFiles(root: string, out: ObservationInput[]): Promise<void> {
  const files = await collectFiles(root)
  if (files.length === 0) return

  let defaultExports = 0
  let namedExports = 0
  let totalCommentLines = 0
  let totalCodeLines = 0
  let usesAny = 0
  let strictTyped = 0

  for (const filePath of files.slice(0, 20)) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      defaultExports += (content.match(/^export default /gm) ?? []).length
      namedExports += (content.match(/^export (const|function|class|type|interface) /gm) ?? []).length

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          totalCommentLines++
        } else if (trimmed.length > 0) {
          totalCodeLines++
        }
      }

      usesAny += (content.match(/: any\b/g) ?? []).length
      strictTyped += (content.match(/: [A-Z][a-zA-Z<>]+/g) ?? []).length
    } catch {}
  }

  const total = defaultExports + namedExports
  if (total > 5) {
    if (namedExports / total > 0.75) {
      out.push({ key: 'export-style', value: 'Use named exports, never default exports', category: 'code-style', source: 'code-analysis' })
    } else if (defaultExports / total > 0.75) {
      out.push({ key: 'export-style', value: 'Default exports are preferred in this codebase', category: 'code-style', source: 'code-analysis' })
    }
  }

  if (totalCodeLines > 50) {
    const commentRatio = totalCommentLines / (totalCodeLines + totalCommentLines)
    if (commentRatio < 0.05) {
      out.push({ key: 'comments', value: 'Minimal comments — code is self-documenting', category: 'code-style', source: 'code-analysis' })
    } else if (commentRatio > 0.2) {
      out.push({ key: 'comments', value: 'Verbose commenting style used throughout', category: 'code-style', source: 'code-analysis' })
    }
  }

  if (strictTyped > 10 && usesAny < 2) {
    out.push({ key: 'typing', value: 'Strict typing — no implicit any, explicit types everywhere', category: 'code-style', source: 'code-analysis' })
  }
}

async function detectFromGitHistory(root: string, out: ObservationInput[]): Promise<void> {
  try {
    const { simpleGit } = await import('simple-git')
    const git = simpleGit(root)
    const isRepo = await git.checkIsRepo().catch(() => false)
    if (!isRepo) return

    const log = await git.log({ maxCount: 30 }).catch(() => ({ all: [] }))
    const messages = (log.all ?? []).map((c) => c.message)

    if (messages.length < 5) return

    // Detect commit style
    const conventional = messages.filter((m) => /^(feat|fix|chore|docs|refactor|test|perf|ci|build|style)(\([^)]+\))?:/.test(m))
    if (conventional.length / messages.length > 0.6) {
      out.push({ key: 'commit-style', value: 'Use conventional commits format (feat:, fix:, chore:, etc.)', category: 'workflow', source: 'git-analysis' })
    }

    // Detect message length preference
    const avgLen = messages.reduce((sum, m) => sum + m.length, 0) / messages.length
    if (avgLen < 30) {
      out.push({ key: 'commit-length', value: 'Short, terse commit messages preferred', category: 'workflow', source: 'git-analysis' })
    } else if (avgLen > 80) {
      out.push({ key: 'commit-length', value: 'Descriptive commit messages with full context', category: 'workflow', source: 'git-analysis' })
    }
  } catch {}
}

async function detectFromConfig(root: string, out: ObservationInput[]): Promise<void> {
  // Prettier = formatting is delegated to tools
  const prettierConfigs = ['.prettierrc', '.prettierrc.json', 'prettier.config.js', 'prettier.config.ts']
  for (const cfg of prettierConfigs) {
    try {
      await fs.access(path.join(root, cfg))
      out.push({ key: 'formatting', value: 'Use Prettier for all code formatting — do not reformat manually', category: 'workflow', source: 'code-analysis' })
      break
    } catch {}
  }

  // TypeScript strict
  try {
    const raw = await fs.readFile(path.join(root, 'tsconfig.json'), 'utf-8')
    const stripped = raw.replace(/\/\/[^\n]*/g, '')
    const tsconfig = JSON.parse(stripped)
    if (tsconfig.compilerOptions?.strict) {
      out.push({ key: 'ts-strict', value: 'Always maintain TypeScript strict mode compatibility', category: 'code-style', source: 'code-analysis' })
    }
  } catch {}
}

async function collectFiles(root: string): Promise<string[]> {
  const files: string[] = []
  const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage'])

  async function walk(dir: string, depth = 0) {
    if (depth > 3 || files.length >= 20) return
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (IGNORED.has(entry.name)) continue
        const full = path.join(dir, entry.name)
        if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
          files.push(full)
        } else if (entry.isDirectory()) {
          await walk(full, depth + 1)
        }
      }
    } catch {}
  }

  await walk(path.join(root, 'src')).catch(() => walk(root))
  return files
}
