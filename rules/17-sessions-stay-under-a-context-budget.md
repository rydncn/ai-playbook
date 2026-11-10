# Sessions stay under a context budget

**Area:** agent context · **Enforced by:** the [`context-budget.mjs`](../templates/hooks/context-budget.mjs) hook

## Rule

A working session adds no more than about 100,000 tokens to its context, counted from its first reply (or its first reply after a compaction). When it passes that, finish the current step, write a handoff (the `/handoff` skill, or `docs/handoff.md`) and continue in a fresh session that starts from it. Keep the budget even on models whose window is far larger. Expensive exploration goes to subagents, which return only their findings. One session per task: a new task starts a new session rather than inheriting the last one's context.

## Why

Agents follow their instructions less closely and make worse decisions as the context grows, well before the window is full: the rules loaded at the start compete with everything read since. Compaction keeps a long session going, but it carries forward a summary written by the model, which loses detail without saying what it lost. A handoff is the same summary written on purpose, which the user can read and correct, and a fresh session gives it the attention of a short context. The budget counts what the session added rather than the total, because the harness's own instructions and tools arrive before any work and vary widely: a few thousand tokens locally, about 80,000 in a cloud session. That is a compromise: those instructions still take attention, so the warning reports the total as well, and a project with a heavy harness can lower the budget. The 100,000 figure is a practitioner's working threshold (Matt Pocock's "smart zone"), not a measured limit; a project that finds a different one changes the setting.

A handoff describes the work, not the machine. In the second trial a fresh session started in a fresh container without the tools the handoff said were installed, and spent twenty minutes finding out; tool installs belong in a setup script the next session runs.

## How to enforce it

The hook reads the context size from the session's transcript each time the user sends a message, and once the session has added more than the budget tells Claude to suggest the handoff and shows the user the same. Set a different budget with `CLAUDE_CONTEXT_BUDGET` in the `env` block of `.claude/settings.json`. The hook only advises: it never blocks, because stopping in the middle of a step costs more than finishing it.
