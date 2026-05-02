Run the following steps in order:

1. **Recall current state** — read CLAUDE.md to understand where we are.

2. **Update CLAUDE.md** — append/update these sections (do not remove existing content):
   - What was completed this session
   - Current task in progress
   - Next steps (ordered)
   - Any architectural or design decisions made
   - Any blockers or open questions

3. **Update memory** — at `~/.claude/projects/-Users-ashishluthra-Desktop/memory/`, add or update entries for anything worth carrying into future sessions (new feedback rules, project context, references). Refresh `MEMORY.md` index. Skip if nothing new is worth saving.

4. **Typecheck before committing** — run `pnpm typecheck`. If it fails, stop and report the errors instead of committing.

5. **Stage explicitly** — never `git add -A` or `git add .`. Add only the specific files changed in this session by name. Skip any file that may contain secrets (`.env*`, `credentials*`, `*.pem`, `*.key`, anything under `.claude/settings*.json`). If unsure about a file, ask before staging.

6. **Commit and push** —
   - Commit message format: `checkpoint: [one line summary of what changed]`
   - Push to the current branch.

7. **Confirm** — print: files staged, commit hash, branch pushed to, memory entries added/updated, and any files intentionally left unstaged.
