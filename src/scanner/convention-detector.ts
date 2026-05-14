import fs from 'fs/promises'
import path from 'path'

export interface Conventions {
  typescript: string[]
  imports: string[]
  exports: string[]
  naming: string[]
  testing: string[]
  style: string[]
}

export async function detectConventions(projectRoot: string, sourceFiles: string[]): Promise<string[]> {
  const conventions: string[] = []

  // TypeScript config analysis
  const tsConventions = await analyzeTsConfig(projectRoot)
  conventions.push(...tsConventions)

  // Source file sampling
  if (sourceFiles.length > 0) {
    const fileConventions = await analyzeSourceFiles(sourceFiles)
    conventions.push(...fileConventions)
  }

  // ESLint analysis
  const eslintConventions = await analyzeEslint(projectRoot)
  conventions.push(...eslintConventions)

  // Prettier check
  const prettierConventions = await analyzePrettier(projectRoot)
  conventions.push(...prettierConventions)

  return [...new Set(conventions)].slice(0, 12)
}

async function analyzeTsConfig(projectRoot: string): Promise<string[]> {
  const conventions: string[] = []
  const configs = ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.base.json']

  for (const cfg of configs) {
    try {
      const raw = await fs.readFile(path.join(projectRoot, cfg), 'utf-8')
      // Strip comments for JSON parsing
      const stripped = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
      const tsconfig = JSON.parse(stripped)
      const opts = tsconfig.compilerOptions ?? {}

      if (opts.strict) conventions.push('Strict TypeScript mode')
      if (opts.noImplicitAny) conventions.push('No implicit any')
      if (opts.exactOptionalPropertyTypes) conventions.push('Exact optional property types')
      if (opts.noUncheckedIndexedAccess) conventions.push('No unchecked indexed access')

      const paths = opts.paths ?? {}
      if (Object.keys(paths).some((k) => k.startsWith('@/'))) conventions.push('@/ path aliases for imports')
      if (opts.target) conventions.push(`TypeScript target: ${opts.target}`)

      break
    } catch {}
  }

  return conventions
}

async function analyzeSourceFiles(files: string[]): Promise<string[]> {
  const conventions: string[] = []
  let defaultExports = 0
  let namedExports = 0
  let hasJsx = false
  const namingPatterns = { kebab: 0, camel: 0, pascal: 0 }
  let usesPathAliases = false
  let usesAsyncAwait = false
  let usesServerComponents = false

  await Promise.all(
    files.map(async (filePath) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const fileName = path.basename(filePath, path.extname(filePath))

        // Export style detection
        const defaultExportMatches = content.match(/^export default /gm) ?? []
        const namedExportMatches = content.match(/^export (const|function|class|type|interface) /gm) ?? []
        defaultExports += defaultExportMatches.length
        namedExports += namedExportMatches.length

        // JSX detection
        if (/\.tsx?$/.test(filePath) && (content.includes('<') && content.includes('/>'))) hasJsx = true

        // Path aliases
        if (content.includes("from '@/") || content.includes('from "@/')) usesPathAliases = true

        // Async/await
        if (content.includes('async ') && content.includes('await ')) usesAsyncAwait = true

        // Server components (Next.js)
        if (content.includes("'use server'") || content.includes('"use server"')) usesServerComponents = true

        // File naming convention
        if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(fileName)) namingPatterns.kebab++
        else if (/^[a-z][a-zA-Z0-9]*$/.test(fileName)) namingPatterns.camel++
        else if (/^[A-Z][a-zA-Z0-9]*$/.test(fileName)) namingPatterns.pascal++
      } catch {}
    }),
  )

  // Export style
  const total = defaultExports + namedExports
  if (total > 0) {
    if (namedExports / total > 0.7) conventions.push('Named exports preferred (no default exports)')
    else if (defaultExports / total > 0.7) conventions.push('Default exports used')
    else conventions.push('Mixed export styles')
  }

  // File naming
  const maxNaming = Math.max(namingPatterns.kebab, namingPatterns.camel, namingPatterns.pascal)
  if (maxNaming > 0) {
    if (namingPatterns.kebab === maxNaming) conventions.push('kebab-case file naming')
    else if (namingPatterns.pascal === maxNaming) conventions.push('PascalCase component files')
    else conventions.push('camelCase file naming')
  }

  if (usesPathAliases) conventions.push('@/ path aliases used throughout')
  if (usesAsyncAwait) conventions.push('Async/await pattern for async operations')
  if (usesServerComponents) conventions.push("Server components with 'use server' directive")

  return conventions
}

async function analyzeEslint(projectRoot: string): Promise<string[]> {
  const configs = ['eslint.config.js', 'eslint.config.ts', 'eslint.config.mjs', '.eslintrc.json', '.eslintrc.js', '.eslintrc']
  for (const cfg of configs) {
    try {
      await fs.access(path.join(projectRoot, cfg))
      return ['ESLint enforced code style']
    } catch {}
  }
  return []
}

async function analyzePrettier(projectRoot: string): Promise<string[]> {
  const configs = ['.prettierrc', '.prettierrc.json', '.prettierrc.js', 'prettier.config.js', 'prettier.config.ts']
  for (const cfg of configs) {
    try {
      await fs.access(path.join(projectRoot, cfg))
      return ['Prettier code formatting']
    } catch {}
  }
  return []
}
