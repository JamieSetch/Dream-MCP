import chokidar from 'chokidar'
import path from 'path'
import { classifyChange, shouldTriggerUpdate, summarizeChanges, type ClassifiedChange } from './change-analyzer.js'
import { performIncrementalUpdate } from './section-updater.js'
import { logger } from '../utils/logger.js'

const WATCH_PATTERNS = [
  'src',
  'app',
  'pages',
  'components',
  'lib',
  'server',
  'api',
  'prisma',
  'drizzle',
  'migrations',
  'package.json',
  'tsconfig.json',
  'go.mod',
  'pyproject.toml',
  'Cargo.toml',
  '.env.example',
  '.env.sample',
]

const IGNORED = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/coverage/**',
  '**/*.log',
  '**/*.lock',
  '**/.dream/**',
]

interface WatcherOptions {
  debounceMs?: number
  onUpdate?: (changes: ClassifiedChange[]) => void
}

export function startWatcher(projectRoot: string, opts: WatcherOptions = {}) {
  const debounceMs = opts.debounceMs ?? 10_000
  const watchPaths = WATCH_PATTERNS.map((p) => path.join(projectRoot, p))

  const pendingChanges: ClassifiedChange[] = []
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const watcher = chokidar.watch(watchPaths, {
    ignored: IGNORED,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500 },
  })

  async function flush() {
    if (pendingChanges.length === 0) return

    const changes = [...pendingChanges]
    pendingChanges.length = 0

    if (!shouldTriggerUpdate(changes)) return

    const summaries = summarizeChanges(changes)
    logger.info(`Detected ${changes.length} change(s) — updating memory...`)

    try {
      await performIncrementalUpdate(projectRoot, changes, summaries)
      logger.success('Memory updated')
      opts.onUpdate?.(changes)
    } catch (err) {
      logger.error(`Failed to update memory: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(flush, debounceMs)
  }

  function handleChange(event: 'add' | 'change' | 'unlink', filePath: string) {
    const classified = classifyChange(filePath, event)
    pendingChanges.push(classified)
    schedule()
  }

  watcher
    .on('add', (p) => handleChange('add', p))
    .on('change', (p) => handleChange('change', p))
    .on('unlink', (p) => handleChange('unlink', p))
    .on('error', (err) => logger.error(`Watcher error: ${err}`))

  logger.success('Watching for changes...')
  logger.dim(`Debounce: ${debounceMs / 1000}s | Root: ${projectRoot}`)

  return {
    close: () => watcher.close(),
    flush,
  }
}
