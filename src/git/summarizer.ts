import type { CommitInfo, GitInfo } from './analyzer.js'

export function summarizeRecentActivity(git: GitInfo): { date: string; items: string[] }[] {
  if (!git.isRepo || git.commits.length === 0) return []

  // Group commits by date
  const byDate = new Map<string, string[]>()

  for (const commit of git.commits) {
    const date = commit.date
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date)!.push(formatCommit(commit))
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 5)
    .map(([date, items]) => ({ date, items }))
}

function formatCommit(commit: CommitInfo): string {
  const msg = commit.message.trim()

  // Format conventional commits
  const conventional = msg.match(/^(feat|fix|chore|docs|style|refactor|test|perf|ci|build|revert)(\(([^)]+)\))?:\s*(.+)/i)
  if (conventional) {
    const [, type, , scope, description] = conventional
    const prefix = getPrefix(type.toLowerCase())
    return scope ? `${prefix} ${description} (${scope})` : `${prefix} ${description}`
  }

  // Truncate long messages
  return msg.length > 80 ? msg.slice(0, 77) + '...' : msg
}

function getPrefix(type: string): string {
  const map: Record<string, string> = {
    feat: 'Added',
    fix: 'Fixed',
    chore: 'Updated',
    docs: 'Documented',
    style: 'Styled',
    refactor: 'Refactored',
    test: 'Added tests for',
    perf: 'Optimized',
    ci: 'Updated CI for',
    build: 'Updated build for',
    revert: 'Reverted',
  }
  return map[type] ?? 'Updated'
}

export function formatContributors(git: GitInfo): string {
  if (!git.contributors.length) return ''
  return git.contributors.join(', ')
}

export function formatProjectAge(git: GitInfo): string {
  if (!git.firstCommit) return ''
  const start = new Date(git.firstCommit)
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()
  if (months < 1) return 'less than a month old'
  if (months === 1) return '1 month old'
  if (months < 12) return `${months} months old`
  const years = Math.floor(months / 12)
  return `${years} year${years > 1 ? 's' : ''} old`
}
