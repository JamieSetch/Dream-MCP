import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { URL } from 'url'
import { readMemory, readTasks } from '../memory/manager.js'
import { findProjectRoot } from '../utils/paths.js'
import { readState } from '../utils/state.js'

export function registerResources(server: McpServer) {
  // ─── dream://memory ──────────────────────────────────────────────────────
  server.resource(
    'dream-memory',
    'dream://memory',
    {
      description: 'Full project memory including stack, architecture, conventions, and recent changes',
      mimeType: 'text/markdown',
    },
    async (uri: URL) => {
      const projectRoot = await findProjectRoot()
      const content = await readMemory(projectRoot)

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: content ?? '# No memory found\n\nRun `dream init` to initialize Dream in this project.',
          },
        ],
      }
    },
  )

  // ─── dream://tasks ───────────────────────────────────────────────────────
  server.resource(
    'dream-tasks',
    'dream://tasks',
    {
      description: 'Current sprint tasks, backlog, and completed work',
      mimeType: 'text/markdown',
    },
    async (uri: URL) => {
      const projectRoot = await findProjectRoot()
      const content = await readTasks(projectRoot)

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: content ?? '# No TASKS.md found\n\nRun `dream init` to initialize Dream.',
          },
        ],
      }
    },
  )

  // ─── dream://stack ───────────────────────────────────────────────────────
  server.resource(
    'dream-stack',
    'dream://stack',
    {
      description: 'JSON summary of the detected tech stack for this project',
      mimeType: 'application/json',
    },
    async (uri: URL) => {
      const projectRoot = await findProjectRoot()
      const state = await readState(projectRoot)
      const memory = await readMemory(projectRoot)

      const stackInfo: Record<string, string | number> = {
        language: state.detectedLanguage,
        lastScan: state.lastScan,
        tokenCount: state.tokenCount,
      }

      if (memory) {
        const stackMatch = memory.match(/# STACK\n([\s\S]*?)(?=\n#|$)/)
        if (stackMatch) {
          const stackLines = stackMatch[1].trim().split('\n')
          for (const line of stackLines) {
            const colonIdx = line.indexOf(': ')
            if (colonIdx !== -1) {
              const key = line.slice(0, colonIdx).trim()
              const val = line.slice(colonIdx + 2).trim()
              stackInfo[key] = val
            }
          }
        }
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(stackInfo, null, 2),
          },
        ],
      }
    },
  )
}
