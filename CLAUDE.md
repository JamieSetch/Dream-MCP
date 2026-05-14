# PROJECT
Name: dream-mcp
Purpose: Persistent project memory for Claude Code sessions
Stage: development

# STACK
Language: TypeScript
Package Manager: npm

# ARCHITECTURE
- Shared utilities layer

# FOLDER STRUCTURE
bin/ — Application code
src/ — Main source code

# CONVENTIONS
- Strict TypeScript mode
- TypeScript target: ES2022
- kebab-case file naming
- Async/await pattern for async operations

# RECENT CHANGES
2026-05-14
- Clarify dream init vs /dream global scope in README
- Fix bin path format for npm publish
- Fix bin script filename for npm publish
- Add bin wrapper for clean npm publish
- Fix concurrent write race condition in MCP tools
- Full-width logo with centered text
- Center logo and update first-person voice
- Initial release: Dream v1.0.0
- cd "/Users/jamiesetch/Desktop/Dream MCP" git add . git commit -m "Initial rel...

# HOW CLAUDE SHOULD OPERATE
- Preserve existing architecture patterns and folder structure
- Avoid introducing duplicate logic — check existing utilities first
- Maintain strict typing — no implicit any
- Update CLAUDE.md after significant architectural changes

# CLAUDE PREFERENCES
_Auto-learned from 4 observations. Last updated: 2026-05-14_

## Code Style
- Always maintain TypeScript strict mode compatibility _(weak signal)_
- Use named exports, never default exports _(weak signal)_
- Minimal comments — code is self-documenting _(weak signal)_
- Strict typing — no implicit any, explicit types everywhere _(weak signal)_
