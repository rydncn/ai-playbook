# Hooks

Four Claude Code hooks that check the agent's setup and work while it is working, rather than waiting for CI, and a git hook for everyone else. The Claude Code hooks are Node scripts with no dependencies, so they run on macOS, Linux and Windows.

| Hook                                       | When it runs                                             | What it does                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`check-plugins.mjs`](check-plugins.mjs)   | When a session starts                                    | Compares the plugins `.claude/settings.json` enables with the ones actually installed, and tells Claude which are missing. Enabling a plugin in project settings doesn't install it in a cloud session, or in the session that wrote the settings, and without this the playbook's flow quietly falls back to doing everything by hand.                                                                                |
| [`context-budget.mjs`](context-budget.mjs) | Each time the user sends a message                       | Reads the session's context size from its transcript. Once the session has added more than the budget since its first reply or its last compaction (100,000 tokens, or `CLAUDE_CONTEXT_BUDGET`), it tells Claude to suggest a handoff and a fresh session at the next natural break, and shows the user the same; again every 50,000 tokens after ([rule 17](../../rules/17-sessions-stay-under-a-context-budget.md)). |
| [`after-edit.mjs`](after-edit.mjs)         | After every `Edit`, `Write` or `MultiEdit`               | Formats the changed file with the project's Prettier and lints it with its ESLint. Lint errors go straight back to Claude.                                                                                                                                                                                                                                                                                             |
| [`before-stop.mjs`](before-stop.mjs)       | When Claude is about to finish a turn that changed files | Runs the `typecheck`, `lint` and `test:changed` scripts. If one fails, Claude is sent back to fix it, or to say plainly that it couldn't, instead of reporting the work as done. It sends Claude back once per stop, so it can't loop.                                                                                                                                                                                 |
| [`pre-push`](pre-push)                     | Before any `git push`, by anyone                         | Runs the type check and lint, for agents and people working outside Claude Code.                                                                                                                                                                                                                                                                                                                                       |

Each skips anything the project doesn't have (no Prettier, no `test:changed` script, no git, no plugins enabled), so they never break a session.

## Using them

1. Copy all five files into the project's `.claude/hooks/`.
2. Merge [`settings.hooks.json`](settings.hooks.json) into the committed `.claude/settings.json`.
3. Add `"prepare": "git config core.hooksPath .claude/hooks || true"` to `package.json`, so every install points git at the same folder for `pre-push`. Git only runs files named after its hooks, so the `.mjs` files beside it are ignored.
4. Add a fast `test:changed` script: `vitest run --changed` or `jest --onlyChanged`. Keep the Stop hook's checks to what runs in seconds; the full suite belongs in CI.
5. Check they run ([rule 9](../../rules/09-checks-must-prove-they-ran.md)); a hook with a wrong path fails silently:
   - ask Claude to make a change that breaks the type check, and watch it get sent back;
   - push a branch with a type error, and watch the push get refused;
   - start a session with one enabled plugin uninstalled, and watch the warning appear;
   - set `CLAUDE_CONTEXT_BUDGET` to `20000` in a session's environment, work until it passes, and watch the warning appear once.

`pre-push` saves a round trip to CI but doesn't replace it: `git push --no-verify` skips it, and instructions in `CLAUDE.md` or `AGENTS.md` asking agents to run checks get skipped in long sessions. CI stays the gate.

The tests run with `node --test templates/hooks/hooks.test.mjs`, including every hook end to end as Claude Code or git runs it.
