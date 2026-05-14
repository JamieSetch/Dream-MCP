import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  readMemory,
  updateCurrentTask,
  addOpenIssue,
  resolveIssue,
  appendRecentChange,
} from '../memory/manager.js'
import { performFullRescan } from '../updater/section-updater.js'
import { findProjectRoot } from '../utils/paths.js'
import { recordObservation, readPreferences } from '../preferences/manager.js'
import { renderPreferencesSection, renderAsClaudeInstructions } from '../preferences/renderer.js'
import { PREFERENCE_CATEGORIES } from '../preferences/schema.js'
import { syncToObsidian } from '../obsidian/syncer.js'
import { readConfig } from '../utils/config.js'

export function registerTools(server: McpServer) {
  // ─── dream_get_context ───────────────────────────────────────────────────
  server.tool(
    'dream_get_context',
    'Returns the full project memory context including stack, architecture, conventions, current task, and recent changes.',
    {},
    async () => {
      const projectRoot = await findProjectRoot()
      const content = await readMemory(projectRoot)

      if (!content) {
        return {
          content: [{ type: 'text' as const, text: 'No Dream memory found. Run `dream init` in your project root.' }],
        }
      }

      return {
        content: [{ type: 'text' as const, text: content }],
      }
    },
  )

  // ─── dream_update_task ───────────────────────────────────────────────────
  server.tool(
    'dream_update_task',
    'Update the CURRENT TASK section in CLAUDE.md to reflect what is being worked on now.',
    { task: z.string().describe('Description of the current task or objective') },
    async ({ task }) => {
      const projectRoot = await findProjectRoot()
      await updateCurrentTask(projectRoot, task)
      return {
        content: [{ type: 'text' as const, text: `Current task updated: "${task}"` }],
      }
    },
  )

  // ─── dream_add_issue ─────────────────────────────────────────────────────
  server.tool(
    'dream_add_issue',
    'Add an open issue or known bug to the OPEN ISSUES section of CLAUDE.md.',
    { issue: z.string().describe('Description of the issue or bug') },
    async ({ issue }) => {
      const projectRoot = await findProjectRoot()
      await addOpenIssue(projectRoot, issue)
      return {
        content: [{ type: 'text' as const, text: `Issue added: "${issue}"` }],
      }
    },
  )

  // ─── dream_resolve_issue ─────────────────────────────────────────────────
  server.tool(
    'dream_resolve_issue',
    'Remove a resolved issue from the OPEN ISSUES section by matching text.',
    { issue: z.string().describe('Text to match against the issue to remove') },
    async ({ issue }) => {
      const projectRoot = await findProjectRoot()
      const resolved = await resolveIssue(projectRoot, issue)
      return {
        content: [
          {
            type: 'text' as const,
            text: resolved ? `Issue resolved and removed: "${issue}"` : `No matching issue found for: "${issue}"`,
          },
        ],
      }
    },
  )

  // ─── dream_log_change ────────────────────────────────────────────────────
  server.tool(
    'dream_log_change',
    "Append changes to today's entry in the RECENT CHANGES section of CLAUDE.md.",
    { items: z.array(z.string()).describe('List of change descriptions to log') },
    async ({ items }) => {
      const projectRoot = await findProjectRoot()
      await appendRecentChange(projectRoot, items)
      return {
        content: [{ type: 'text' as const, text: `Logged ${items.length} change(s) to RECENT CHANGES` }],
      }
    },
  )

  // ─── dream_rescan ────────────────────────────────────────────────────────
  server.tool(
    'dream_rescan',
    'Trigger a full repository rescan and regenerate the CLAUDE.md memory file.',
    {},
    async () => {
      const projectRoot = await findProjectRoot()
      const { tokenCount } = await performFullRescan(projectRoot)
      return {
        content: [{ type: 'text' as const, text: `Repository rescanned. Memory regenerated (~${tokenCount} tokens).` }],
      }
    },
  )

  // ─── dream_observe_preference ────────────────────────────────────────────
  server.tool(
    'dream_observe_preference',
    `Record a user preference observed during this session. Call this whenever the user corrects your behavior, expresses a preference, or you notice a consistent pattern. Examples: "user prefers concise responses", "user dislikes emojis", "user wants named exports only". Conflicts are resolved by frequency — the most-observed preference wins. This feeds into all future Claude sessions for this project.`,
    {
      key: z.string().describe('Short identifier for this preference type (e.g. "response-length", "export-style", "comment-density")'),
      value: z.string().describe('The preference as a direct instruction Claude should follow (e.g. "Keep responses under 3 sentences unless asked for detail")'),
      category: z.enum(PREFERENCE_CATEGORIES).describe('Which category this preference belongs to'),
    },
    async ({ key, value, category }) => {
      const projectRoot = await findProjectRoot()
      const { merged, conflictResolved, entry } = await recordObservation(projectRoot, {
        key,
        value,
        category,
        source: 'claude',
      })

      const status = conflictResolved
        ? `Conflict resolved by frequency — kept: "${entry.value}" (${entry.count} observations)`
        : merged
          ? `Preference reinforced (now observed ${entry.count}x, strength: ${entry.strength})`
          : `New preference recorded`

      return {
        content: [{ type: 'text' as const, text: `Preference saved: "${key}" → "${value}"\n${status}` }],
      }
    },
  )

  // ─── dream_get_preferences ───────────────────────────────────────────────
  server.tool(
    'dream_get_preferences',
    'Returns all learned user preferences for this project, grouped by category and sorted by strength.',
    {},
    async () => {
      const projectRoot = await findProjectRoot()
      const prefs = await readPreferences(projectRoot)
      const rendered = renderPreferencesSection(prefs)
      const instructions = renderAsClaudeInstructions(prefs)

      const text = rendered
        ? `## User Preferences\n\n${rendered}\n\n## As Claude Instructions\n${instructions.map((i) => `- ${i}`).join('\n')}`
        : 'No preferences recorded yet for this project.'

      return {
        content: [{ type: 'text' as const, text }],
      }
    },
  )

  // ─── dream_sync_obsidian ─────────────────────────────────────────────────
  server.tool(
    'dream_sync_obsidian',
    'Sync current project memory to the connected Obsidian vault. Creates or updates the project note.',
    {},
    async () => {
      const projectRoot = await findProjectRoot()
      const config = await readConfig(projectRoot)

      if (!config.obsidian?.enabled || !config.obsidian?.vaultPath) {
        return {
          content: [{ type: 'text' as const, text: 'Obsidian not connected. Run `dream obsidian connect` first.' }],
        }
      }

      const memory = await readMemory(projectRoot)
      if (!memory) {
        return {
          content: [{ type: 'text' as const, text: 'No memory to sync. Run `dream init` first.' }],
        }
      }

      const result = await syncToObsidian(projectRoot, config.obsidian.vaultPath, config.obsidian.folder ?? 'Dream')
      return {
        content: [{ type: 'text' as const, text: result.message }],
      }
    },
  )
}
