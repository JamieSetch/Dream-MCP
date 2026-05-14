import fs from 'fs/promises'
import crypto from 'crypto'
import { statePath } from './paths.js'

export interface DreamState {
  lastScan: string
  fileHashes: Record<string, string>
  tokenCount: number
  detectedLanguage: string
  version: string
}

const EMPTY_STATE: DreamState = {
  lastScan: '',
  fileHashes: {},
  tokenCount: 0,
  detectedLanguage: 'unknown',
  version: '1.0.0',
}

export async function readState(projectRoot: string): Promise<DreamState> {
  try {
    const raw = await fs.readFile(statePath(projectRoot), 'utf-8')
    return JSON.parse(raw) as DreamState
  } catch {
    return { ...EMPTY_STATE }
  }
}

export async function writeState(projectRoot: string, state: DreamState): Promise<void> {
  await fs.writeFile(statePath(projectRoot), JSON.stringify(state, null, 2) + '\n', 'utf-8')
}

export async function hashFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 8)
  } catch {
    return ''
  }
}

export async function buildFileHashes(
  projectRoot: string,
  files: string[],
): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {}
  await Promise.all(
    files.map(async (f) => {
      const h = await hashFile(f)
      if (h) hashes[f.replace(projectRoot + '/', '')] = h
    }),
  )
  return hashes
}
