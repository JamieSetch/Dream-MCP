import chalk from 'chalk'
import { findProjectRoot } from '../../utils/paths.js'
import { readConfig, writeConfig } from '../../utils/config.js'
import { detectObsidianVaults, validateVaultPath } from '../../obsidian/detector.js'
import { syncToObsidian, removeFromObsidian } from '../../obsidian/syncer.js'
import { logger } from '../../utils/logger.js'
import readline from 'readline'

export async function obsidianConnectCommand(vaultPath?: string) {
  const projectRoot = await findProjectRoot()

  console.log(chalk.bold.cyan('\n  ◆ Dream — Obsidian Connect\n'))

  let resolvedPath: string

  if (vaultPath) {
    resolvedPath = vaultPath
  } else {
    // Auto-detect
    logger.info('Scanning for Obsidian vaults...')
    const vaults = await detectObsidianVaults()

    if (vaults.length === 0) {
      logger.warn('No Obsidian vaults found automatically.')
      logger.dim('Specify a vault path: dream obsidian connect /path/to/vault')
      return
    }

    console.log(chalk.dim('\n  Found vaults:\n'))
    vaults.forEach((v, i) => {
      const badge = v.source === 'icloud' ? chalk.blue('[iCloud]') : chalk.dim('[local]')
      const verified = v.hasObsidianDir ? chalk.green('✓') : chalk.yellow('?')
      console.log(`  ${i + 1}. ${verified} ${badge} ${chalk.white(v.name)} — ${chalk.dim(v.path)}`)
    })

    if (vaults.length === 1) {
      console.log()
      resolvedPath = vaults[0].path
      logger.info(`Auto-selected: ${vaults[0].name}`)
    } else {
      // Let user pick
      const answer = await prompt(`\n  Select vault [1-${vaults.length}]: `)
      const idx = parseInt(answer.trim(), 10) - 1
      if (isNaN(idx) || idx < 0 || idx >= vaults.length) {
        logger.error('Invalid selection')
        return
      }
      resolvedPath = vaults[idx].path
    }
  }

  const validation = await validateVaultPath(resolvedPath)
  if (!validation.valid) {
    logger.error(`Invalid vault path: ${validation.reason}`)
    return
  }
  if (validation.reason) {
    logger.warn(validation.reason)
  }

  // Save to config
  const config = await readConfig(projectRoot)
  config.obsidian = {
    enabled: true,
    vaultPath: resolvedPath,
    folder: 'Dream',
    autoSync: true,
  }
  await writeConfig(projectRoot, config)
  logger.success(`Obsidian vault connected: ${resolvedPath}`)

  // Initial sync
  logger.info('Running initial sync...')
  const result = await syncToObsidian(projectRoot, resolvedPath, 'Dream')
  if (result.success) {
    logger.success(result.message)
    console.log(chalk.dim(`\n  Note path: ${result.notePath}`))
    console.log(chalk.dim('  Auto-sync is ON — memory syncs on every `dream scan` or `dream update`\n'))
  } else {
    logger.error(result.message)
  }
}

export async function obsidianSyncCommand() {
  const projectRoot = await findProjectRoot()
  const config = await readConfig(projectRoot)

  if (!config.obsidian?.enabled || !config.obsidian?.vaultPath) {
    logger.error('Obsidian not connected. Run `dream obsidian connect` first.')
    return
  }

  const result = await syncToObsidian(projectRoot, config.obsidian.vaultPath, config.obsidian.folder ?? 'Dream')
  if (result.success) {
    logger.success(result.message)
  } else {
    logger.error(result.message)
  }
}

export async function obsidianStatusCommand() {
  const projectRoot = await findProjectRoot()
  const config = await readConfig(projectRoot)

  console.log(chalk.bold.cyan('\n  ◆ Dream — Obsidian Status\n'))

  if (!config.obsidian?.enabled) {
    console.log(chalk.red('  ✗ Obsidian not connected'))
    console.log(chalk.dim('  Run: dream obsidian connect'))
    console.log()
    return
  }

  const obs = config.obsidian
  console.log(chalk.green('  ✓ Obsidian connected'))
  console.log(chalk.dim('  Vault: ') + chalk.white(obs.vaultPath))
  console.log(chalk.dim('  Folder: ') + chalk.white(obs.folder ?? 'Dream'))
  console.log(chalk.dim('  Auto-sync: ') + (obs.autoSync ? chalk.green('on') : chalk.yellow('off')))
  console.log()
}

export async function obsidianDisconnectCommand() {
  const projectRoot = await findProjectRoot()
  const config = await readConfig(projectRoot)

  if (!config.obsidian?.enabled) {
    logger.warn('Obsidian not connected')
    return
  }

  config.obsidian.enabled = false
  await writeConfig(projectRoot, config)
  logger.success('Obsidian disconnected. Your vault files remain unchanged.')
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}
