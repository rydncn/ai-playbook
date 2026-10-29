# How I work with Claude (all projects)

<!--
This is the master copy of my personal defaults. scripts/install.sh links it to
~/.claude/CLAUDE.md, so edits here apply to every project on this machine.
Keep it to habits that are true everywhere; project facts go in each project's CLAUDE.md.
-->

## Working loop

- For anything beyond a small, obvious change, use the Superpowers flow: brainstorm, write a plan, then execute it. Don't jump straight to implementation.
- Prefer the simplest solution that works: reuse what exists, use the standard library, and don't add abstractions nobody asked for.
- Every task needs a way to check it's done (a test, a command and its expected output, or a manual check). If there isn't one, propose one before starting.
- Write tests before the implementation when practical, and never weaken a test to make it pass.
- Stay inside the agreed scope. If you find something else that needs fixing, tell me instead of fixing it silently.

## Communication

- Ask when a choice is ambiguous and expensive to undo; otherwise make a sensible call and say what you chose.
- Be direct about uncertainty and about things that didn't work. Don't report success you haven't verified.
- Keep summaries short: what changed, how it was checked, what's left.
- When a session gets long or the work moves to a new session, offer to write a handoff.

## Code

- Match the existing style and patterns of the codebase over your own preferences.
- Prefer small, reviewable changes and small commits.
- Reference code as `path:line`.

## Safety

- Never read, print, or commit secrets, `.env` files, or credentials.
- Ask before anything destructive or hard to reverse: deleting files or data, force-pushing, rewriting history, changing infrastructure or permissions.
- Ask before anything that reaches a shared or production environment (deploys, database pushes, app publishes, releases), even when a permission rule would let it run.
- Run tests in single-run mode, never watch mode.

## Lessons (apply everywhere)

<!-- Promote lessons here from project CLAUDE.md files when they turn out to be universal. -->

- Write lessons into the repo (CLAUDE.md or `.claude/rules/`), not only into auto memory, so they reach every machine and cloud session.
