import { simpleGit } from 'simple-git'
import path from 'path'

export interface CommitInfo {
  hash: string
  date: string
  message: string
  author: string
  files: string[]
}

export interface GitInfo {
  isRepo: boolean
  branch: string
  commits: CommitInfo[]
  contributors: string[]
  firstCommit: string | null
  hasUncommitted: boolean
  uncommittedFiles: string[]
}

export async function analyzeGit(projectRoot: string): Promise<GitInfo> {
  const git = simpleGit(projectRoot)

  try {
    const isRepo = await git.checkIsRepo()
    if (!isRepo) {
      return emptyGitInfo()
    }

    const [branch, log, status] = await Promise.all([
      git.revparse(['--abbrev-ref', 'HEAD']).catch(() => 'main'),
      git.log({ maxCount: 20, '--': undefined }).catch(() => ({ all: [] })),
      git.status().catch(() => null),
    ])

    const commits: CommitInfo[] = await Promise.all(
      (log.all ?? []).map(async (commit) => {
        let files: string[] = []
        try {
          const diff = await git.diff([`${commit.hash}^`, commit.hash, '--name-only'])
          files = diff.trim().split('\n').filter(Boolean).slice(0, 10)
        } catch {}
        return {
          hash: commit.hash.slice(0, 7),
          date: commit.date.slice(0, 10),
          message: commit.message,
          author: commit.author_name,
          files,
        }
      }),
    )

    // Get unique contributors
    const contributors = [...new Set(commits.map((c) => c.author))].slice(0, 5)

    // Get first commit date
    let firstCommit: string | null = null
    try {
      const first = await git.log({ '--reverse': null, maxCount: 1 })
      firstCommit = first.all[0]?.date?.slice(0, 10) ?? null
    } catch {}

    const uncommittedFiles = status
      ? [...(status.modified ?? []), ...(status.not_added ?? []), ...(status.deleted ?? [])]
      : []

    return {
      isRepo: true,
      branch: branch.trim(),
      commits,
      contributors,
      firstCommit,
      hasUncommitted: uncommittedFiles.length > 0,
      uncommittedFiles,
    }
  } catch {
    return emptyGitInfo()
  }
}

function emptyGitInfo(): GitInfo {
  return {
    isRepo: false,
    branch: '',
    commits: [],
    contributors: [],
    firstCommit: null,
    hasUncommitted: false,
    uncommittedFiles: [],
  }
}

export async function getRecentChangesFromGit(projectRoot: string, since?: string): Promise<{ date: string; items: string[] }[]> {
  const git = simpleGit(projectRoot)

  try {
    const args: string[] = ['--pretty=format:%H|%ad|%s', '--date=short', '--name-only']
    if (since) args.push(`--since=${since}`)
    else args.push('--max-count=10')

    const raw = await git.raw(['log', ...args])
    if (!raw.trim()) return []

    return parseGitLogToChanges(raw)
  } catch {
    return []
  }
}

function parseGitLogToChanges(raw: string): { date: string; items: string[] }[] {
  const blocks = raw.trim().split(/\n\n+/)
  const byDate = new Map<string, string[]>()

  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean)
    if (!lines[0]) continue

    const [hash, date, ...msgParts] = lines[0].split('|')
    if (!date) continue

    const message = msgParts.join('|').trim()
    const summary = formatCommitMessage(message)

    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date)!.push(summary)
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 5)
    .map(([date, items]) => ({ date, items }))
}

function formatCommitMessage(message: string): string {
  // Clean up common prefixes and make human readable
  return message
    .replace(/^(feat|fix|chore|docs|style|refactor|test|perf|ci|build|revert)(\([^)]+\))?:\s*/i, (_, type) => {
      const map: Record<string, string> = {
        feat: 'added',
        fix: 'fixed',
        chore: 'updated',
        docs: 'documented',
        style: 'styled',
        refactor: 'refactored',
        test: 'tested',
        perf: 'optimized',
        ci: 'configured CI for',
        build: 'configured build for',
        revert: 'reverted',
      }
      return (map[type.toLowerCase()] ?? type) + ' '
    })
    .trim()
}
