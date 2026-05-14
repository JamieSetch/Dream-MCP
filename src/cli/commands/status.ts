import fs from 'fs/promises'
import chalk from 'chalk'
import { findProjectRoot, dreamDir, claudeMdPath, mcpJsonPath } from '../../utils/paths.js'
import { readState } from '../../utils/state.js'
import { readMemory } from '../../memory/manager.js'
import { parseSections } from '../../memory/diff.js'
import { estimateTokens } from '../../utils/tokens.js'

export async function statusCommand() {
  const projectRoot = await findProjectRoot()

  console.log(chalk.bold.cyan('\n  ◆ Dream — Status\n'))
  console.log(chalk.dim('  Project: ') + chalk.white(projectRoot))

  // Check dream dir
  const hasDreamDir = await fs.access(dreamDir(projectRoot)).then(() => true).catch(() => false)
  const hasMemory = await fs.access(claudeMdPath(projectRoot)).then(() => true).catch(() => false)
  const hasMcpJson = await fs.access(mcpJsonPath(projectRoot)).then(() => true).catch(() => false)

  console.log()

  if (!hasDreamDir || !hasMemory) {
    console.log(chalk.red('  ✗ Dream not initialized in this project'))
    console.log(chalk.dim('  Run: ') + chalk.white('dream init'))
    console.log()
    return
  }

  console.log(chalk.green('  ✓ Dream initialized') + chalk.dim(` (.dream/)`))

  // Memory info
  const memory = await readMemory(projectRoot)
  if (memory) {
    const tokenCount = estimateTokens(memory)
    const sections = parseSections(memory)
    const budget = 1500
    const budgetPct = Math.round((tokenCount / budget) * 100)
    const budgetColor = tokenCount < budget * 0.8 ? chalk.green : tokenCount < budget ? chalk.yellow : chalk.red

    console.log(chalk.green('  ✓ CLAUDE.md found') + chalk.dim(` (${tokenCount} tokens, ${budgetPct}% of budget)`))
    console.log(chalk.dim('  Sections: ') + chalk.white([...sections.keys()].join(', ')))

    const stackSection = sections.get('STACK')
    if (stackSection) {
      const stackLines = stackSection.split('\n').filter(Boolean).slice(0, 3)
      for (const line of stackLines) {
        console.log(chalk.dim('  ' + line))
      }
    }
  }

  // MCP config
  if (hasMcpJson) {
    try {
      const raw = await fs.readFile(mcpJsonPath(projectRoot), 'utf-8')
      const parsed = JSON.parse(raw)
      const hasDream = parsed.mcpServers?.dream !== undefined
      if (hasDream) {
        console.log(chalk.green('  ✓ .mcp.json configured with dream MCP server'))
      } else {
        console.log(chalk.yellow('  ⚠ .mcp.json exists but dream server not configured'))
      }
    } catch {
      console.log(chalk.yellow('  ⚠ .mcp.json exists but could not parse'))
    }
  } else {
    console.log(chalk.red('  ✗ .mcp.json not found'))
    console.log(chalk.dim('  Run: ') + chalk.white('dream init') + chalk.dim(' to configure'))
  }

  // State info
  const state = await readState(projectRoot)
  if (state.lastScan) {
    const lastScan = new Date(state.lastScan)
    const ageMs = Date.now() - lastScan.getTime()
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
    const ageStr = ageDays === 0 ? 'today' : ageDays === 1 ? 'yesterday' : `${ageDays} days ago`
    const ageColor = ageDays < 3 ? chalk.green : ageDays < 7 ? chalk.yellow : chalk.red

    console.log(ageColor(`  ✓ Last scan: ${ageStr}`) + chalk.dim(` (${state.lastScan.slice(0, 10)})`))
  } else {
    console.log(chalk.yellow('  ⚠ No scan state found'))
  }

  console.log()
  console.log(chalk.dim('  dream scan   — refresh full memory'))
  console.log(chalk.dim('  dream update — sync recent git changes'))
  console.log(chalk.dim('  dream doctor — validate full setup'))
  console.log()
}
