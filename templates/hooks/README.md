# Hooks

Three Claude Code hooks that check the agent's setup and work while it is working, rather than waiting for CI, and a git hook for everyone else. The Claude Code hooks are Node scripts with no dependencies, so they run on macOS, Linux and Windows.

| Hook                                     | When it runs                                             | What it does                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`check-plugins.mjs`](check-plugins.mjs) | When a session starts                                    | Compares the plugins `.claude/settings.json` enables with the ones actually installed, and tells Claude which are missing. Enabling a plugin in project settings doesn't install it in a cloud session, or in the session that wrote the settings, and without this the playbook's flow quietly falls back to doing everything by hand. |
| [`after-edit.mjs`](after-edit.mjs)       | After every `Edit`, `Write` or `MultiEdit`               | Runs the project's edit checks from `.claude/checks.json` on the changed file (for Go: `gofmt` and `go vet`), or, without that file, formats it with the project's Prettier and lints it with its ESLint. A failing check is shown to Claude straight away.                                                                             |
| [`before-stop.mjs`](before-stop.mjs)     | When Claude is about to finish a turn that changed files | Runs the stop checks from `.claude/checks.json`, or, without it, the `typecheck`, `lint` and `test:changed` scripts. If one fails, Claude is sent back to fix it, once, so it can't loop.                                                                                                                                               |
| [`pre-push`](pre-push)                   | Before any `git push`, by anyone                         | Runs the type check and lint, for agents and people working outside Claude Code.                                                                                                                                                                                                                                                        |

Each skips anything the project doesn't have (no Prettier, no `test:changed` script, no git, no plugins enabled), so they never break a session.

## Using them

1. Copy all five files (the four hooks and `checks.mjs`, which the edit and stop hooks share) into the project's `.claude/hooks/`. For a project that isn't npm, also copy its stack pack's `checks.json` to `.claude/checks.json` ([`../stacks`](../stacks)); a `checks.json` that can't be read is reported to Claude, never skipped.
2. Merge [`settings.hooks.json`](settings.hooks.json) into the committed `.claude/settings.json`.
3. Add `"prepare": "git config core.hooksPath .claude/hooks || true"` to `package.json`, so every install points git at the same folder for `pre-push`. Git only runs files named after its hooks, so the `.mjs` files beside it are ignored.
4. Add a fast `test:changed` script: `vitest run --changed` or `jest --onlyChanged`. Keep the Stop hook's checks to what runs in seconds; the full suite belongs in CI.
5. Check they run ([rule 9](../../rules/09-checks-must-prove-they-ran.md)); a hook with a wrong path fails silently:
   - ask Claude to make a change that breaks the type check, and watch it get sent back;
   - push a branch with a type error, and watch the push get refused;
   - start a session with one enabled plugin uninstalled, and watch the warning appear;

`pre-push` saves a round trip to CI but doesn't replace it: `git push --no-verify` skips it, and instructions in `CLAUDE.md` or `AGENTS.md` asking agents to run checks get skipped in long sessions. CI stays the gate.

The tests run with `node --test templates/hooks/hooks.test.mjs`, including every hook end to end as Claude Code or git runs it.
