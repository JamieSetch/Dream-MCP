import { z } from 'zod'

export const ProjectStack = z.object({
  frontend: z.string().optional(),
  backend: z.string().optional(),
  database: z.string().optional(),
  orm: z.string().optional(),
  auth: z.string().optional(),
  styling: z.string().optional(),
  testing: z.string().optional(),
  infra: z.string().optional(),
  runtime: z.enum(['node', 'bun', 'deno']).default('node'),
  language: z.string().default('TypeScript'),
  packageManager: z.string().optional(),
  buildTool: z.string().optional(),
})

export const RecentChange = z.object({
  date: z.string(),
  items: z.array(z.string()),
})

export const ProjectMemory = z.object({
  name: z.string(),
  purpose: z.string(),
  stage: z.enum(['prototype', 'development', 'production']).default('development'),
  stack: ProjectStack,
  architecture: z.array(z.string()),
  folderStructure: z.record(z.string()),
  conventions: z.array(z.string()),
  features: z.array(z.string()),
  currentTask: z.string().optional(),
  openIssues: z.array(z.string()),
  recentChanges: z.array(RecentChange),
  claudeInstructions: z.array(z.string()),
  scannedAt: z.string(),
})

export type ProjectMemory = z.infer<typeof ProjectMemory>
export type ProjectStack = z.infer<typeof ProjectStack>
export type RecentChange = z.infer<typeof RecentChange>

export const EMPTY_MEMORY: ProjectMemory = {
  name: 'Unknown Project',
  purpose: '',
  stage: 'development',
  stack: {
    runtime: 'node',
    language: 'TypeScript',
  },
  architecture: [],
  folderStructure: {},
  conventions: [],
  features: [],
  openIssues: [],
  recentChanges: [],
  claudeInstructions: [
    'Preserve existing architecture patterns',
    'Maintain strict typing throughout',
    'Avoid duplicate logic',
    'Update CLAUDE.md after significant changes',
  ],
  scannedAt: new Date().toISOString(),
}
