import { z } from 'zod'

export const PREFERENCE_CATEGORIES = [
  'response-style',
  'code-style',
  'workflow',
  'communication',
  'custom',
] as const

export type PreferenceCategory = typeof PREFERENCE_CATEGORIES[number]

export const PreferenceEntry = z.object({
  key: z.string(),
  value: z.string(),
  category: z.enum(PREFERENCE_CATEGORIES),
  count: z.number().default(1),
  conflictCount: z.number().default(0),
  firstSeen: z.string(),
  lastSeen: z.string(),
  source: z.enum(['claude', 'code-analysis', 'git-analysis', 'manual']),
  strength: z.enum(['low', 'medium', 'high']).default('low'),
})

export type PreferenceEntry = z.infer<typeof PreferenceEntry>

export const UserPreferences = z.object({
  version: z.string().default('1.0.0'),
  totalObservations: z.number().default(0),
  lastUpdated: z.string(),
  entries: z.array(PreferenceEntry),
})

export type UserPreferences = z.infer<typeof UserPreferences>

export const EMPTY_PREFERENCES: UserPreferences = {
  version: '1.0.0',
  totalObservations: 0,
  lastUpdated: new Date().toISOString(),
  entries: [],
}

export function computeStrength(count: number): PreferenceEntry['strength'] {
  if (count >= 5) return 'high'
  if (count >= 2) return 'medium'
  return 'low'
}

export interface ObservationInput {
  key: string
  value: string
  category: PreferenceCategory
  source: PreferenceEntry['source']
  conflicts?: string
}
