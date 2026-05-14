import path from 'path'
import fs from 'fs/promises'

const ROOT_MARKERS = [
  'package.json',
  'go.mod',
  'Cargo.toml',
  'pyproject.toml',
  'pom.xml',
  'build.gradle',
  '.git',
]

export async function findProjectRoot(startDir: string = process.cwd()): Promise<string> {
  let dir = startDir
  const MAX_WALK = 4 // never walk more than 4 levels up

  for (let depth = 0; depth < MAX_WALK; depth++) {
    for (const marker of ROOT_MARKERS) {
      try {
        await fs.access(path.join(dir, marker))
        return dir
      } catch {
        // not found, continue
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break // reached filesystem root
    dir = parent
  }

  return startDir // fallback: use the directory we were called from
}

export function dreamDir(projectRoot: string): string {
  return path.join(projectRoot, '.dream')
}

export function claudeMdPath(projectRoot: string): string {
  return path.join(projectRoot, 'CLAUDE.md')
}

export function tasksMdPath(projectRoot: string): string {
  return path.join(projectRoot, 'TASKS.md')
}

export function mcpJsonPath(projectRoot: string): string {
  return path.join(projectRoot, '.mcp.json')
}

export function configPath(projectRoot: string): string {
  return path.join(dreamDir(projectRoot), 'config.json')
}

export function statePath(projectRoot: string): string {
  return path.join(dreamDir(projectRoot), 'state.json')
}

export function watcherPidPath(projectRoot: string): string {
  return path.join(dreamDir(projectRoot), 'watcher.pid')
}
