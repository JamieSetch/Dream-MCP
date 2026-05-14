import fs from 'fs/promises'
import path from 'path'

export interface PackageInfo {
  name: string
  description: string
  version: string
  type: 'module' | 'commonjs' | 'unknown'
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  allDeps: Set<string>
  hasTypeScript: boolean
  language: 'TypeScript' | 'JavaScript' | 'Python' | 'Go' | 'Rust' | 'Java' | 'Unknown'
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown'
  runtime: 'node' | 'bun' | 'deno'
}

export interface PythonInfo {
  name: string
  description: string
  dependencies: string[]
  pythonVersion: string
}

export interface GoInfo {
  moduleName: string
  goVersion: string
}

export async function scanPackageJson(projectRoot: string): Promise<PackageInfo | null> {
  const pkgPath = path.join(projectRoot, 'package.json')
  try {
    const raw = await fs.readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(raw)

    const deps: Record<string, string> = pkg.dependencies ?? {}
    const devDeps: Record<string, string> = pkg.devDependencies ?? {}
    const allDeps = new Set([...Object.keys(deps), ...Object.keys(devDeps)])

    const hasTypeScript = allDeps.has('typescript') || allDeps.has('ts-node') || allDeps.has('tsx')

    // Detect runtime
    let runtime: PackageInfo['runtime'] = 'node'
    try {
      await fs.access(path.join(projectRoot, 'bun.lockb'))
      runtime = 'bun'
    } catch {}
    try {
      await fs.access(path.join(projectRoot, 'deno.json'))
      runtime = 'deno'
    } catch {}

    // Detect package manager from lock files
    let packageManager: PackageInfo['packageManager'] = 'unknown'
    const lockChecks: Array<[string, PackageInfo['packageManager']]> = [
      ['bun.lockb', 'bun'],
      ['pnpm-lock.yaml', 'pnpm'],
      ['yarn.lock', 'yarn'],
      ['package-lock.json', 'npm'],
    ]
    for (const [file, pm] of lockChecks) {
      try {
        await fs.access(path.join(projectRoot, file))
        packageManager = pm
        break
      } catch {}
    }

    return {
      name: pkg.name ?? path.basename(projectRoot),
      description: pkg.description ?? '',
      version: pkg.version ?? '0.0.0',
      type: pkg.type === 'module' ? 'module' : pkg.type === 'commonjs' ? 'commonjs' : 'unknown',
      scripts: pkg.scripts ?? {},
      dependencies: deps,
      devDependencies: devDeps,
      allDeps,
      hasTypeScript,
      language: hasTypeScript ? 'TypeScript' : 'JavaScript',
      packageManager,
      runtime,
    }
  } catch {
    return null
  }
}

export async function scanPythonProject(projectRoot: string): Promise<PythonInfo | null> {
  // Try pyproject.toml first
  try {
    const raw = await fs.readFile(path.join(projectRoot, 'pyproject.toml'), 'utf-8')
    const nameMatch = raw.match(/^name\s*=\s*"([^"]+)"/m)
    const descMatch = raw.match(/^description\s*=\s*"([^"]+)"/m)
    const pyMatch = raw.match(/python\s*=\s*"([^"]+)"/m)
    const depsMatch = raw.match(/dependencies\s*=\s*\[([\s\S]*?)\]/m)
    const deps = depsMatch
      ? depsMatch[1].match(/"([^"]+)"/g)?.map((d) => d.replace(/"/g, '')) ?? []
      : []
    return {
      name: nameMatch?.[1] ?? path.basename(projectRoot),
      description: descMatch?.[1] ?? '',
      pythonVersion: pyMatch?.[1] ?? '3.x',
      dependencies: deps,
    }
  } catch {}

  // Try requirements.txt
  try {
    const raw = await fs.readFile(path.join(projectRoot, 'requirements.txt'), 'utf-8')
    const deps = raw.split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.split('==')[0].split('>=')[0].trim())
    return {
      name: path.basename(projectRoot),
      description: '',
      pythonVersion: '3.x',
      dependencies: deps,
    }
  } catch {}

  return null
}

export async function scanGoProject(projectRoot: string): Promise<GoInfo | null> {
  try {
    const raw = await fs.readFile(path.join(projectRoot, 'go.mod'), 'utf-8')
    const moduleMatch = raw.match(/^module\s+(\S+)/m)
    const goMatch = raw.match(/^go\s+(\S+)/m)
    return {
      moduleName: moduleMatch?.[1] ?? '',
      goVersion: goMatch?.[1] ?? '',
    }
  } catch {
    return null
  }
}

export async function scanRustProject(projectRoot: string): Promise<{ name: string; version: string } | null> {
  try {
    const raw = await fs.readFile(path.join(projectRoot, 'Cargo.toml'), 'utf-8')
    const nameMatch = raw.match(/^name\s*=\s*"([^"]+)"/m)
    const versionMatch = raw.match(/^version\s*=\s*"([^"]+)"/m)
    return {
      name: nameMatch?.[1] ?? path.basename(projectRoot),
      version: versionMatch?.[1] ?? '0.1.0',
    }
  } catch {
    return null
  }
}
