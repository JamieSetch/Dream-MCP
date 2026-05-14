const today = () => new Date().toISOString().slice(0, 10)

export function generateTasksMd(projectName: string): string {
  return `# TASKS — ${projectName}

## Current Sprint

<!-- Add active tasks here -->
- [ ]

## Backlog

<!-- Planned future work -->

## Completed

<!-- Move finished tasks here with date -->

---
_Last updated: ${today()}_
_Managed by Dream — update with \`dream update\` or directly via Claude_
`
}
