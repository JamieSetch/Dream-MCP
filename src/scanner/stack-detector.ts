import fs from 'fs/promises'
import path from 'path'
import type { PackageInfo, PythonInfo, GoInfo } from './package-scanner.js'
import type { ProjectStack } from '../memory/schema.js'

// ─── JS/TS Detection ────────────────────────────────────────────────────────

const FRONTEND_MAP: Array<[string[], string, ((root: string, deps: Set<string>) => Promise<string>) | null]> = [
  [['next'], 'Next.js', detectNextVersion],
  [['nuxt'], 'Nuxt.js', null],
  [['@sveltejs/kit'], 'SvelteKit', null],
  [['svelte'], 'Svelte', null],
  [['astro'], 'Astro', null],
  [['@remix-run/react', '@remix-run/node'], 'Remix', null],
  [['@angular/core'], 'Angular', null],
  [['solid-js'], 'Solid.js', null],
  [['vue'], 'Vue.js', null],
  [['react', 'react-dom'], 'React', null],
]

const BACKEND_MAP: Array<[string[], string]> = [
  [['@nestjs/core'], 'NestJS'],
  [['fastify'], 'Fastify'],
  [['hono'], 'Hono'],
  [['@hono/node-server'], 'Hono'],
  [['koa'], 'Koa'],
  [['elysia'], 'Elysia'],
  [['express'], 'Express.js'],
  [['@trpc/server'], 'tRPC'],
]

const DATABASE_MAP: Array<[string[], string, string]> = [
  [['@prisma/client'], 'PostgreSQL / MySQL / SQLite', 'Prisma'],
  [['drizzle-orm'], 'SQL', 'Drizzle ORM'],
  [['typeorm'], 'SQL', 'TypeORM'],
  [['mongoose'], 'MongoDB', 'Mongoose'],
  [['sequelize'], 'SQL', 'Sequelize'],
  [['better-sqlite3', '@libsql/client'], 'SQLite / Turso', 'direct'],
  [['pg', 'postgres'], 'PostgreSQL', 'direct'],
  [['mysql2'], 'MySQL', 'direct'],
  [['redis', 'ioredis'], 'Redis', 'direct'],
]

const AUTH_MAP: Array<[string[], string]> = [
  [['@clerk/nextjs', '@clerk/clerk-sdk-node', '@clerk/backend'], 'Clerk'],
  [['next-auth', '@auth/core'], 'NextAuth.js'],
  [['@supabase/supabase-js'], 'Supabase Auth'],
  [['passport'], 'Passport.js'],
  [['@lucia-auth/adapter'], 'Lucia'],
  [['better-auth'], 'BetterAuth'],
]

const STYLING_MAP: Array<[string[], string]> = [
  [['tailwindcss'], 'Tailwind CSS'],
  [['@mui/material'], 'Material UI'],
  [['@chakra-ui/react'], 'Chakra UI'],
  [['styled-components'], 'Styled Components'],
  [['@emotion/react'], 'Emotion'],
  [['@radix-ui/react-primitives', 'shadcn-ui'], 'Radix UI / shadcn'],
]

const TESTING_MAP: Array<[string[], string]> = [
  [['vitest'], 'Vitest'],
  [['jest', '@jest/core'], 'Jest'],
  [['playwright', '@playwright/test'], 'Playwright'],
  [['cypress'], 'Cypress'],
  [['@testing-library/react'], 'Testing Library'],
]

const INFRA_MAP: Array<[string[], string]> = [
  [['wrangler', '@cloudflare/workers-types'], 'Cloudflare Workers'],
  [['serverless'], 'Serverless Framework'],
  [['@aws-sdk/client-s3', '@aws-sdk/client-lambda'], 'AWS SDK'],
  [['firebase', 'firebase-admin'], 'Firebase'],
  [['@supabase/supabase-js'], 'Supabase'],
]

const BUILD_MAP: Array<[string[], string]> = [
  [['vite', '@vitejs/plugin-react'], 'Vite'],
  [['turbo'], 'Turborepo'],
  [['tsup'], 'tsup'],
  [['webpack'], 'Webpack'],
  [['esbuild'], 'esbuild'],
]

async function detectNextVersion(root: string, deps: Set<string>): Promise<string> {
  try {
    await fs.access(path.join(root, 'app'))
    return 'Next.js (App Router)'
  } catch {}
  try {
    await fs.access(path.join(root, 'pages'))
    return 'Next.js (Pages Router)'
  } catch {}
  return 'Next.js'
}

function detect<T extends string>(allDeps: Set<string>, map: Array<[string[], T, ...unknown[]]>): T | undefined {
  for (const [keys, name] of map) {
    if (keys.some((k) => allDeps.has(k))) return name
  }
  return undefined
}

function detectWithExtra(allDeps: Set<string>, map: Array<[string[], string, string]>): { name: string; extra: string } | undefined {
  for (const [keys, name, extra] of map) {
    if (keys.some((k) => allDeps.has(k))) return { name, extra }
  }
  return undefined
}

async function detectFrontend(root: string, allDeps: Set<string>): Promise<string | undefined> {
  for (const [keys, name, resolver] of FRONTEND_MAP) {
    if (keys.some((k) => allDeps.has(k))) {
      if (resolver) return resolver(root, allDeps)
      return name
    }
  }
  return undefined
}

export async function detectJsTsStack(root: string, pkg: PackageInfo): Promise<Partial<ProjectStack>> {
  const deps = pkg.allDeps

  const [frontend, dbInfo, auth, styling, testing, infra, buildTool] = await Promise.all([
    detectFrontend(root, deps),
    Promise.resolve(detectWithExtra(deps, DATABASE_MAP)),
    Promise.resolve(detect(deps, AUTH_MAP)),
    Promise.resolve(detect(deps, STYLING_MAP)),
    Promise.resolve(detect(deps, TESTING_MAP)),
    Promise.resolve(detect(deps, INFRA_MAP)),
    Promise.resolve(detect(deps, BUILD_MAP)),
  ])

  const backend = detect(deps, BACKEND_MAP)

  return {
    frontend,
    backend,
    database: dbInfo?.name,
    orm: dbInfo?.extra !== 'direct' ? dbInfo?.extra : undefined,
    auth,
    styling,
    testing,
    infra,
    runtime: pkg.runtime,
    language: pkg.language,
    packageManager: pkg.packageManager !== 'unknown' ? pkg.packageManager : undefined,
    buildTool,
  }
}

// ─── Python Detection ────────────────────────────────────────────────────────

const PYTHON_FRAMEWORK_MAP: Array<[string, string]> = [
  ['fastapi', 'FastAPI'],
  ['django', 'Django'],
  ['flask', 'Flask'],
  ['starlette', 'Starlette'],
  ['litestar', 'Litestar'],
  ['tornado', 'Tornado'],
]

const PYTHON_DB_MAP: Array<[string, string]> = [
  ['sqlalchemy', 'SQLAlchemy'],
  ['sqlmodel', 'SQLModel'],
  ['tortoise-orm', 'Tortoise ORM'],
  ['motor', 'MongoDB (Motor)'],
  ['pymongo', 'MongoDB'],
  ['psycopg2', 'PostgreSQL'],
  ['psycopg', 'PostgreSQL'],
]

export function detectPythonStack(info: PythonInfo): Partial<ProjectStack> {
  const deps = new Set(info.dependencies.map((d) => d.toLowerCase()))
  let backend: string | undefined
  let database: string | undefined

  for (const [dep, name] of PYTHON_FRAMEWORK_MAP) {
    if (deps.has(dep)) { backend = name; break }
  }
  for (const [dep, name] of PYTHON_DB_MAP) {
    if (deps.has(dep)) { database = name; break }
  }

  return { language: 'Python', backend, database, runtime: 'node' }
}

// ─── Go Detection ────────────────────────────────────────────────────────────

export function detectGoStack(info: GoInfo): Partial<ProjectStack> {
  return { language: 'Go', runtime: 'node' }
}

// ─── Architecture inference ──────────────────────────────────────────────────

export async function inferArchitecture(root: string, stack: Partial<ProjectStack>): Promise<string[]> {
  const arch: string[] = []

  const checks: Array<[string, string]> = [
    ['app', `${stack.frontend ?? 'App'} App Router structure`],
    ['pages', `${stack.frontend ?? 'App'} Pages Router structure`],
    ['prisma/schema.prisma', 'Prisma schema-driven database layer'],
    ['drizzle.config.ts', 'Drizzle schema-driven database layer'],
    ['src/server', 'Dedicated server-side layer'],
    ['src/lib', 'Shared library layer'],
    ['src/components', 'Component-based UI architecture'],
    ['src/hooks', 'Custom React hooks layer'],
    ['src/store', 'Client-side state management layer'],
    ['src/services', 'Service-layer backend structure'],
    ['src/api', 'API route handlers'],
    ['src/middleware', 'Middleware pipeline'],
    ['src/types', 'Centralized type definitions'],
    ['src/utils', 'Shared utilities layer'],
    ['docker-compose.yml', 'Docker Compose multi-service setup'],
    ['Dockerfile', 'Containerized deployment'],
    ['.github/workflows', 'GitHub Actions CI/CD'],
  ]

  await Promise.all(
    checks.map(async ([checkPath, label]) => {
      try {
        await fs.access(path.join(root, checkPath))
        arch.push(label)
      } catch {}
    }),
  )

  if (stack.orm) arch.unshift(`${stack.orm} ORM`)
  if (stack.frontend && stack.backend) arch.unshift('Full-stack monorepo')
  else if (stack.frontend) arch.unshift('Frontend application')
  else if (stack.backend) arch.unshift('Backend API')

  return arch.slice(0, 10)
}
