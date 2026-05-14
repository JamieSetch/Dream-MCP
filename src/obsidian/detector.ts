import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface VaultCandidate {
  path: string
  name: string
  source: 'icloud' | 'documents' | 'desktop' | 'home' | 'manual'
  hasObsidianDir: boolean
}

const ICLOUD_OBSIDIAN = path.join(
  os.homedir(),
  'Library',
  'Mobile Documents',
  'iCloud~md~obsidian',
  'Documents',
)

const SCAN_ROOTS = [
  { dir: path.join(os.homedir(), 'Documents'), source: 'documents' as const },
  { dir: path.join(os.homedir(), 'Desktop'), source: 'desktop' as const },
  { dir: os.homedir(), source: 'home' as const },
]

export async function detectObsidianVaults(): Promise<VaultCandidate[]> {
  const candidates: VaultCandidate[] = []

  // 1. iCloud Obsidian (macOS)
  try {
    const entries = await fs.readdir(ICLOUD_OBSIDIAN, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const vaultPath = path.join(ICLOUD_OBSIDIAN, entry.name)
      const hasObsidian = await fs.access(path.join(vaultPath, '.obsidian')).then(() => true).catch(() => false)
      candidates.push({
        path: vaultPath,
        name: entry.name,
        source: 'icloud',
        hasObsidianDir: hasObsidian,
      })
    }
  } catch {}

  // 2. Scan common local directories (shallow — only 1 level deep)
  for (const { dir, source } of SCAN_ROOTS) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const candidate = path.join(dir, entry.name)

        // Check if this IS an Obsidian vault
        const hasObsidian = await fs.access(path.join(candidate, '.obsidian')).then(() => true).catch(() => false)
        if (hasObsidian) {
          const alreadyFound = candidates.some((c) => c.path === candidate)
          if (!alreadyFound) {
            candidates.push({
              path: candidate,
              name: entry.name,
              source,
              hasObsidianDir: true,
            })
          }
        }
      }
    } catch {}
  }

  // Prefer vaults with .obsidian dir, then by source priority
  const sourcePriority = { icloud: 0, documents: 1, desktop: 2, home: 3, manual: 4 }
  return candidates.sort((a, b) => {
    if (a.hasObsidianDir !== b.hasObsidianDir) return a.hasObsidianDir ? -1 : 1
    return sourcePriority[a.source] - sourcePriority[b.source]
  })
}

export async function validateVaultPath(vaultPath: string): Promise<{ valid: boolean; reason?: string }> {
  try {
    const stat = await fs.stat(vaultPath)
    if (!stat.isDirectory()) return { valid: false, reason: 'Path is not a directory' }

    const hasObsidian = await fs.access(path.join(vaultPath, '.obsidian')).then(() => true).catch(() => false)
    if (!hasObsidian) {
      return { valid: true, reason: 'Warning: no .obsidian/ directory found — may not be an Obsidian vault' }
    }

    return { valid: true }
  } catch {
    return { valid: false, reason: 'Path does not exist' }
  }
}
