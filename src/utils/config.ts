import fs from 'fs/promises'
import { configPath } from './paths.js'

export interface ObsidianConfig {
  enabled: boolean
  vaultPath: string
  folder: string
  autoSync: boolean
}

export interface DreamConfig {
  version: string
  projectRoot: string
  memoryFile: string
  tasksFile: string
  watchEnabled: boolean
  hooksEnabled: boolean
  ignorePatterns: string[]
  tokenBudget: number
  obsidian?: ObsidianConfig
}

const DEFAULT_CONFIG: Omit<DreamConfig, 'projectRoot'> = {
  version: '1.0.0',
  memoryFile: 'CLAUDE.md',
  tasksFile: 'TASKS.md',
  watchEnabled: false,
  hooksEnabled: false,
  ignorePatterns: [],
  tokenBudget: 1500,
}

export async function readConfig(projectRoot: string): Promise<DreamConfig> {
  try {
    const raw = await fs.readFile(configPath(projectRoot), 'utf-8')
    return JSON.parse(raw) as DreamConfig
  } catch {
    return { ...DEFAULT_CONFIG, projectRoot }
  }
}

export async function writeConfig(projectRoot: string, config: DreamConfig): Promise<void> {
  await fs.writeFile(configPath(projectRoot), JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

export function defaultConfig(projectRoot: string): DreamConfig {
  return { ...DEFAULT_CONFIG, projectRoot }
}
