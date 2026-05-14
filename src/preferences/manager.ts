import fs from 'fs/promises'
import path from 'path'
import { dreamDir } from '../utils/paths.js'
import {
  UserPreferences,
  EMPTY_PREFERENCES,
  PreferenceEntry,
  computeStrength,
  type ObservationInput,
} from './schema.js'

const PREFS_FILE = 'preferences.json'

export function prefsPath(projectRoot: string): string {
  return path.join(dreamDir(projectRoot), PREFS_FILE)
}

export async function readPreferences(projectRoot: string): Promise<UserPreferences> {
  try {
    const raw = await fs.readFile(prefsPath(projectRoot), 'utf-8')
    return UserPreferences.parse(JSON.parse(raw))
  } catch {
    return { ...EMPTY_PREFERENCES, lastUpdated: new Date().toISOString() }
  }
}

export async function writePreferences(projectRoot: string, prefs: UserPreferences): Promise<void> {
  await fs.mkdir(dreamDir(projectRoot), { recursive: true })
  await fs.writeFile(prefsPath(projectRoot), JSON.stringify(prefs, null, 2) + '\n', 'utf-8')
}

export async function recordObservation(
  projectRoot: string,
  observation: ObservationInput,
): Promise<{ merged: boolean; conflictResolved: boolean; entry: PreferenceEntry }> {
  const prefs = await readPreferences(projectRoot)
  const now = new Date().toISOString()
  const today = now.slice(0, 10)

  // Normalize key for matching
  const normalizedKey = observation.key.toLowerCase().trim()

  // Find existing entry with same key
  const existing = prefs.entries.find(
    (e) => e.key.toLowerCase() === normalizedKey && e.category === observation.category,
  )

  // Check for conflict: same key, different value
  const conflict = prefs.entries.find(
    (e) =>
      e.key.toLowerCase() === normalizedKey &&
      e.category === observation.category &&
      e.value.toLowerCase() !== observation.value.toLowerCase(),
  )

  let entry: PreferenceEntry
  let conflictResolved = false

  if (existing && existing.value.toLowerCase() === observation.value.toLowerCase()) {
    // Reinforce existing preference
    existing.count += 1
    existing.lastSeen = now
    existing.strength = computeStrength(existing.count)
    entry = existing
  } else if (conflict) {
    // Conflict resolution: whichever has more observations wins
    conflict.conflictCount += 1
    const newCount = (conflict.conflictCount > 0 ? 1 : 0) + 1

    if (newCount > conflict.count) {
      // New value wins — replace
      conflict.value = observation.value
      conflict.count = newCount
      conflict.conflictCount = 0
      conflict.lastSeen = now
      conflict.strength = computeStrength(newCount)
      conflict.source = observation.source
    }
    // Else existing value wins by frequency
    entry = conflict
    conflictResolved = true
  } else {
    // New preference
    entry = {
      key: observation.key,
      value: observation.value,
      category: observation.category,
      count: 1,
      conflictCount: 0,
      firstSeen: now,
      lastSeen: now,
      source: observation.source,
      strength: 'low',
    }
    prefs.entries.push(entry)
  }

  prefs.totalObservations += 1
  prefs.lastUpdated = now

  await writePreferences(projectRoot, prefs)

  return { merged: !!existing, conflictResolved, entry }
}

export async function setPreference(
  projectRoot: string,
  key: string,
  value: string,
  category: ObservationInput['category'],
): Promise<void> {
  await recordObservation(projectRoot, { key, value, category, source: 'manual' })
}

export async function removePreference(projectRoot: string, key: string): Promise<boolean> {
  const prefs = await readPreferences(projectRoot)
  const before = prefs.entries.length
  prefs.entries = prefs.entries.filter((e) => e.key.toLowerCase() !== key.toLowerCase())
  if (prefs.entries.length === before) return false
  await writePreferences(projectRoot, prefs)
  return true
}

export function groupPreferencesByCategory(prefs: UserPreferences): Map<string, PreferenceEntry[]> {
  const grouped = new Map<string, PreferenceEntry[]>()
  for (const entry of prefs.entries) {
    if (!grouped.has(entry.category)) grouped.set(entry.category, [])
    grouped.get(entry.category)!.push(entry)
  }
  // Sort each group by count desc
  for (const entries of grouped.values()) {
    entries.sort((a, b) => b.count - a.count)
  }
  return grouped
}
