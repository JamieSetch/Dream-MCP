export const DREAM_SLASH_COMMAND = `Summarize this session for Dream (your persistent project memory system) and prepare a handoff for the next session.

Using the Dream MCP tools, do all of the following in order:

**1. Current task**
Call \`dream_update_task\` with a single sentence describing what we are actively working on right now. If we finished everything, write the next logical step instead.

**2. Changes**
Call \`dream_log_change\` with a concise bullet list of everything that was built, changed, or fixed this session. Only include things that matter for future context. Skip exploratory discussion that went nowhere.

**3. Preferences**
For each pattern you noticed about how I like to work, call \`dream_observe_preference\`. Only log things I explicitly stated OR that you observed me correct more than once. Use these categories:
- response-style: how I want you to communicate
- code-style: how I want code written
- workflow: how I want tasks approached
- communication: tone, format, length preferences

**4. Open issues**
If anything is broken, incomplete, or needs follow-up, call \`dream_add_issue\` for each one.

**5. Architecture rescan**
If we introduced new patterns, new directories, new dependencies, or significant refactors — call \`dream_rescan\` to regenerate the full memory from the updated codebase.

**6. Session handoff**
After all tools have been called, output this exact block so the next session can start immediately:

---
## Session saved. Open a new session now — context loads instantly.

**Continuing:** [one sentence: what the next session should do first]

**Loaded into next session:**
- [bullet: key architectural context Claude will know]
- [bullet: current task Claude will know]
- [bullet: any strong preferences Claude will follow]

**Open issues carried forward:**
- [bullet each unresolved issue, or "None" if clear]
---

Be ruthlessly concise. The entire point is that the next session opens cold and immediately knows everything without you typing a word.
`

export const DREAM_SLASH_COMMAND_FILENAME = 'dream.md'
