import chalk from 'chalk'

const isMcpMode = process.argv.includes('mcp')

function log(message: string) {
  if (!isMcpMode) process.stderr.write(message + '\n')
}

export const logger = {
  info: (msg: string) => log(chalk.blue('  ℹ ') + msg),
  success: (msg: string) => log(chalk.green('  ✓ ') + msg),
  warn: (msg: string) => log(chalk.yellow('  ⚠ ') + msg),
  error: (msg: string) => log(chalk.red('  ✗ ') + msg),
  dim: (msg: string) => log(chalk.dim('    ' + msg)),
  section: (msg: string) => log('\n' + chalk.bold.cyan(msg)),
  blank: () => log(''),

  check: (label: string, ok: boolean, detail?: string) => {
    const icon = ok ? chalk.green('✓') : chalk.red('✗')
    const text = ok ? chalk.white(label) : chalk.red(label)
    const extra = detail ? chalk.dim(' — ' + detail) : ''
    log(`  ${icon} ${text}${extra}`)
  },

  raw: (msg: string) => {
    if (!isMcpMode) process.stdout.write(msg + '\n')
  },
}
