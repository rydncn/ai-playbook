# One task per session

**Area:** agent context · **Enforced by:** instruction only

## Rule

Each task starts in a fresh session (`/clear`, or a new session), and a session doesn't carry one task's context into the next. Exploration that reads many files goes to subagents, which return only their findings. After two corrections on the same problem, start again in a fresh session with a better prompt rather than correcting a third time. When the work moves to a new session part-way through, write a handoff (`/handoff`, or `docs/handoff.md`) and start the new session from it. Within one task, let Claude Code compact when it needs to; `/compact <what to keep>` steers what survives.

## Why

Performance falls as the context fills: the instructions loaded at the start compete with everything read since. The cheapest way to keep a context small is not to fill it with unrelated work, which is what Anthropic's own guidance recommends ([best practices](https://code.claude.com/docs/en/best-practices#manage-context-aggressively)): `/clear` between tasks, subagents for investigation, and a fresh session after repeated corrections.

This rule used to set a fixed budget of about 100,000 tokens per session, warned by a hook, with a handoff instead of compaction. It was a practitioner's threshold, not a measured one; it went against the tool's own guidance and nagged during long single-task runs (a review, an audit, a mutation run) where stopping would have cost more than carrying on. So the budget is gone, and what's left is the part the guidance agrees with.

A handoff describes the work, not the machine: a fresh session may start in a fresh container without the tools the last one installed, so tool installs belong in a setup script the next session runs.

## How to enforce it

Instruction only. A slice plan or issue that quotes its criteria and names the design sections it needs ([`PLAN.md`](../templates/PLAN.md), [tickets](../templates/tickets)) keeps a fresh session's start cheap, and an unattended run starts each slice in a fresh session by construction. To see how full a session is, use `/context` or a [status line](https://code.claude.com/docs/en/statusline).
