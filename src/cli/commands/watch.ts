import fs from 'fs/promises'
import chalk from 'chalk'
import { findProjectRoot, watcherPidPath, dreamDir, claudeMdPath } from '../../utils/paths.js'
import { startWatcher } from '../../updater/watcher.js'
import { logger } from '../../utils/logger.js'

interface WatchOptions {
  debounce?: number
}

export async function watchCommand(options: WatchOptions = {}) {
  const projectRoot = await findProjectRoot()

  // Verify dream is initialized
  const hasMemory = await fs.access(claudeMdPath(projectRoot)).then(() => true).catch(() => false)
  if (!hasMemory) {
    logger.error('Dream not initialized. Run `dream init` first.')
    process.exit(1)
  }

  console.log(chalk.bold.cyan('\n  ◆ Dream — Watching for changes\n'))

  await fs.mkdir(dreamDir(projectRoot), { recursive: true })

  // Write PID file
  await fs.writeFile(watcherPidPath(projectRoot), String(process.pid), 'utf-8')

  const debounceMs = (options.debounce ?? 10) * 1000

  const watcher = startWatcher(projectRoot, {
    debounceMs,
    onUpdate: () => {
      logger.success(`Memory updated at ${new Date().toLocaleTimeString()}`)
    },
  })

  // Cleanup on exit
  const cleanup = async () => {
    watcher.close()
    await fs.unlink(watcherPidPath(projectRoot)).catch(() => {})
    console.log(chalk.dim('\n  Dream watcher stopped.\n'))
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  console.log(chalk.dim(`  Press Ctrl+C to stop\n`))
}
