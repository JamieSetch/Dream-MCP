import fs from 'fs/promises'
import path from 'path'

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit',
  'coverage', '.turbo', '.cache', '__pycache__', 'target', 'vendor',
  '.venv', 'venv', 'env', '.env', 'out', '.output',
])

const DIR_PURPOSE_MAP: Record<string, string> = {
  'src': 'Main source code',
  'app': 'Next.js App Router / application entry',
  'pages': 'Next.js Pages Router',
  'components': 'Reusable UI components',
  'lib': 'Shared library utilities',
  'utils': 'Utility functions',
  'hooks': 'Custom React hooks',
  'store': 'State management',
  'services': 'Business logic / service layer',
  'api': 'API routes / handlers',
  'server': 'Server-side code',
  'middleware': 'Middleware functions',
  'types': 'TypeScript type definitions',
  'models': 'Data models',
  'schema': 'Schema definitions',
  'prisma': 'Prisma database schema and migrations',
  'drizzle': 'Drizzle ORM schema',
  'migrations': 'Database migrations',
  'scripts': 'Build / utility scripts',
  'config': 'Configuration files',
  'public': 'Static public assets',
  'static': 'Static assets',
  'assets': 'Media and assets',
  'styles': 'Global styles',
  'test': 'Test files',
  'tests': 'Test files',
  '__tests__': 'Jest test files',
  'e2e': 'End-to-end tests',
  'docs': 'Documentation',
  'infra': 'Infrastructure / IaC code',
  'terraform': 'Terraform infrastructure',
  'k8s': 'Kubernetes manifests',
  'docker': 'Docker configuration',
  'workers': 'Background workers',
  'jobs': 'Scheduled jobs',
  'emails': 'Email templates',
  'i18n': 'Internationalization',
  'locales': 'Locale files',
  'context': 'React context providers',
  'providers': 'React providers',
  'layouts': 'Page layout components',
  'views': 'View components / pages',
  'controllers': 'MVC controllers',
  'routes': 'Route definitions',
  'helpers': 'Helper functions',
  'plugins': 'Plugin configurations',
  'trpc': 'tRPC router definitions',
}

export interface FileSystemInfo {
  topLevelDirs: string[]
  folderStructure: Record<string, string>
  keyFiles: string[]
  fileCount: Record<string, number>
  hasReadme: boolean
  readme: string
}

export async function scanFileSystem(projectRoot: string): Promise<FileSystemInfo> {
  const entries = await fs.readdir(projectRoot, { withFileTypes: true })

  const topLevelDirs: string[] = []
  const folderStructure: Record<string, string> = {}
  const keyFiles: string[] = []
  const fileCount: Record<string, number> = {}

  const KEY_FILES = [
    'README.md', 'CLAUDE.md', 'TASKS.md', '.env.example', '.env.sample',
    'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
    '.github/workflows', 'vercel.json', 'netlify.toml',
    'turbo.json', 'nx.json', 'lerna.json',
  ]

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue
      topLevelDirs.push(entry.name)

      const purpose = DIR_PURPOSE_MAP[entry.name] ?? inferDirPurpose(entry.name)
      folderStructure[entry.name + '/'] = purpose

      // Count files in this dir (shallow)
      try {
        const subEntries = await fs.readdir(path.join(projectRoot, entry.name))
        fileCount[entry.name] = subEntries.length
      } catch {}
    }
  }

  // Check key files
  await Promise.all(
    KEY_FILES.map(async (kf) => {
      try {
        await fs.access(path.join(projectRoot, kf))
        keyFiles.push(kf)
      } catch {}
    }),
  )

  // Read README
  let readme = ''
  let hasReadme = false
  try {
    const readmePath = path.join(projectRoot, 'README.md')
    const raw = await fs.readFile(readmePath, 'utf-8')
    hasReadme = true
    readme = raw.slice(0, 2000) // cap at 2000 chars
  } catch {}

  return { topLevelDirs, folderStructure, keyFiles, fileCount, hasReadme, readme }
}

function inferDirPurpose(name: string): string {
  if (name.includes('test') || name.includes('spec')) return 'Test files'
  if (name.includes('mock')) return 'Mock data / fixtures'
  if (name.includes('util') || name.includes('helper')) return 'Utility functions'
  if (name.includes('component') || name.includes('widget')) return 'UI components'
  if (name.includes('page') || name.includes('view') || name.includes('screen')) return 'Pages / views'
  if (name.includes('model') || name.includes('entity')) return 'Data models'
  if (name.includes('service')) return 'Business logic services'
  if (name.includes('route') || name.includes('controller')) return 'Route handlers'
  if (name.includes('store') || name.includes('redux') || name.includes('state')) return 'State management'
  if (name.includes('config')) return 'Configuration'
  if (name.includes('doc')) return 'Documentation'
  return 'Application code'
}

export async function sampleSourceFiles(projectRoot: string, limit = 10): Promise<string[]> {
  const files: string[] = []

  async function walk(dir: string, depth = 0) {
    if (depth > 3 || files.length >= limit) return
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (files.length >= limit) break
        if (IGNORED_DIRS.has(entry.name)) continue
        const full = path.join(dir, entry.name)
        if (entry.isFile() && /\.(ts|tsx|js|jsx|py|go|rs)$/.test(entry.name) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
          files.push(full)
        } else if (entry.isDirectory()) {
          await walk(full, depth + 1)
        }
      }
    } catch {}
  }

  let startDir = projectRoot
  try {
    await fs.access(path.join(projectRoot, 'src'))
    startDir = path.join(projectRoot, 'src')
  } catch {}

  await walk(startDir, 0)
  if (files.length < limit) await walk(projectRoot, 0)

  return files
}
