import chalk from 'chalk'
import { readMemory, readTasks } from '../memory/manager.js'
import { parseSections } from '../memory/diff.js'
import { estimateTokens } from '../utils/tokens.js'

const SECTION_COLORS: Record<string, (s: string) => string> = {
  'PROJECT': chalk.bold.cyan,
  'STACK': chalk.bold.blue,
  'ARCHITECTURE': chalk.bold.magenta,
  'FOLDER STRUCTURE': chalk.bold.yellow,
  'CONVENTIONS': chalk.bold.green,
  'CURRENT FEATURES': chalk.bold.green,
  'CURRENT TASK': chalk.bold.red,
  'OPEN ISSUES': chalk.bold.yellow,
  'RECENT CHANGES': chalk.bold.blue,
  'HOW CLAUDE SHOULD OPERATE': chalk.bold.cyan,
}

export async function loadContext(projectRoot: string, { plain = false, includeTasks = true } = {}): Promise<void> {
  const [memory, tasks] = await Promise.all([
    readMemory(projectRoot),
    includeTasks ? readTasks(projectRoot) : Promise.resolve(null),
  ])

  if (!memory) {
    console.error(chalk.red('No Dream memory found. Run `dream init` first.'))
    process.exit(1)
  }

  if (plain) {
    process.stdout.write(memory + '\n')
    if (tasks) process.stdout.write('\n---\n\n' + tasks + '\n')
    return
  }

  // Pretty-printed output
  const sections = parseSections(memory)
  const hr = chalk.dim('─'.repeat(60))

  console.log('\n' + chalk.bold.white('  ◆ DREAM — Project Memory') + '\n' + hr)

  for (const [name, body] of sections) {
    const colorFn = SECTION_COLORS[name] ?? chalk.bold.white
    console.log('\n' + colorFn(`  # ${name}`))
    if (body) {
      const lines = body.split('\n')
      for (const line of lines) {
        console.log(chalk.dim('  ') + line)
      }
    }
  }

  const tokenCount = estimateTokens(memory)
  console.log('\n' + hr)
  console.log(chalk.dim(`  ~${tokenCount} tokens | CLAUDE.md`))

  if (tasks) {
    console.log('\n' + chalk.bold.white('  ◆ TASKS') + '\n' + hr)
    console.log(chalk.dim(tasks))
  }

  console.log()
}
