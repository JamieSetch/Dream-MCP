import fs from 'fs/promises'
import { execSync } from 'child_process'
import chalk from 'chalk'
import { findProjectRoot, dreamDir, claudeMdPath, mcpJsonPath } from '../../utils/paths.js'
import { readState } from '../../utils/state.js'
import { readMemory } from '../../memory/manager.js'
import { estimateTokens } from '../../utils/tokens.js'
import { simpleGit } from 'simple-git'

interface Check {
  label: string
  ok: boolean
  detail?: string
  warning?: boolean
}

export async function doctorCommand() {
  const projectRoot = await findProjectRoot()

  console.log(chalk.bold.cyan('\n  ◆ Dream — Doctor\n'))
  console.log(chalk.dim('  Running diagnostics...\n'))

  const checks: Check[] = []

  // 1. .dream/ directory
  const hasDreamDir = await fs.access(dreamDir(projectRoot)).then(() => true).catch(() => false)
  checks.push({ label: '.dream/ directory exists', ok: hasDreamDir })

  // 2. CLAUDE.md
  const memory = await readMemory(projectRoot)
  const hasMemory = memory !== null && memory.length > 100
  checks.push({ label: 'CLAUDE.md exists and non-empty', ok: hasMemory })

  // 3. Token budget
  if (hasMemory && memory) {
    const tokens = estimateTokens(memory)
    const withinBudget = tokens <= 1500
    checks.push({
      label: 'Memory within token budget',
      ok: withinBudget,
      detail: `~${tokens} tokens`,
      warning: !withinBudget,
    })
  }

  // 4. .mcp.json configured
  let mcpConfigured = false
  try {
    const raw = await fs.readFile(mcpJsonPath(projectRoot), 'utf-8')
    const parsed = JSON.parse(raw)
    mcpConfigured = parsed.mcpServers?.dream !== undefined
  } catch {}
  checks.push({ label: '.mcp.json has dream server configured', ok: mcpConfigured })

  // 5. dream command in PATH
  let dreamInPath = false
  try {
    execSync('dream --version', { stdio: 'pipe' })
    dreamInPath = true
  } catch {}
  checks.push({ label: 'dream command reachable in PATH', ok: dreamInPath })

  // 6. Git repo
  let isGitRepo = false
  try {
    const git = simpleGit(projectRoot)
    isGitRepo = await git.checkIsRepo()
  } catch {}
  checks.push({ label: 'Git repository detected', ok: isGitRepo, warning: !isGitRepo })

  // 7. Last scan freshness
  const state = await readState(projectRoot)
  if (state.lastScan) {
    const ageDays = Math.floor((Date.now() - new Date(state.lastScan).getTime()) / (1000 * 60 * 60 * 24))
    const isFresh = ageDays < 7
    checks.push({
      label: 'Memory scan is recent (< 7 days)',
      ok: isFresh,
      detail: ageDays === 0 ? 'today' : `${ageDays} days ago`,
      warning: !isFresh,
    })
  } else {
    checks.push({ label: 'Memory scan state found', ok: false })
  }

  // Print results
  let allPassed = true
  for (const check of checks) {
    const icon = check.ok ? chalk.green('✓') : check.warning ? chalk.yellow('⚠') : chalk.red('✗')
    const text = check.ok ? chalk.white(check.label) : check.warning ? chalk.yellow(check.label) : chalk.red(check.label)
    const detail = check.detail ? chalk.dim(` — ${check.detail}`) : ''
    console.log(`  ${icon} ${text}${detail}`)
    if (!check.ok && !check.warning) allPassed = false
  }

  console.log()
  if (allPassed) {
    console.log(chalk.green('  All checks passed. Dream is healthy.\n'))
  } else {
    console.log(chalk.yellow('  Some checks failed. Run `dream init` to fix setup issues.\n'))
  }
}
