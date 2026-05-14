import { findProjectRoot } from '../../utils/paths.js'
import { loadContext } from '../../loader/index.js'

interface LoadOptions {
  plain?: boolean
  noTasks?: boolean
}

export async function loadCommand(options: LoadOptions = {}) {
  const projectRoot = await findProjectRoot()
  await loadContext(projectRoot, {
    plain: options.plain,
    includeTasks: !options.noTasks,
  })
}
