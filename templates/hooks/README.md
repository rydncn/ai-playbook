# Hooks

Three Claude Code hooks that check the agent's setup and work while it is working, rather than waiting for CI, and a git hook for everyone else. The Claude Code hooks are Node scripts with no dependencies, so they run on macOS, Linux and Windows.

| Hook                                     | When it runs                                             | What it does                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`check-plugins.mjs`](check-plugins.mjs) | When a session starts                                    | Compares the plugins `.claude/settings.json` enables with the ones actually installed, and tells Claude which are missing. Enabling a plugin in project settings doesn't install it in a cloud session, or in the session that wrote the settings, and without this the playbook's flow quietly falls back to doing everything by hand.                                                                                   |
| [`after-edit.mjs`](after-edit.mjs)       | After every `Edit`, `Write`, `MultiEdit` or `Bash`       | Runs the project's edit checks from `.claude/playbook.json` (or the older `.claude/checks.json`) on the changed file (for Go: `gofmt` and `go vet`), or, without that file, formats it with the project's Prettier and lints it with its ESLint. After a shell command, it checks each changed file the command touched, so a `sed -i` gets the same checks as an edit. A failing check is shown to Claude straight away. |
| [`before-stop.mjs`](before-stop.mjs)     | When Claude is about to finish a turn that changed files | Runs the project's commands from `.claude/playbook.json` (format check, lint, type check, then the changed tests), or the older `.claude/checks.json`, or, without either, the `typecheck`, `lint` and `test:changed` scripts. If one fails, Claude is sent back to fix it, once, so it can't loop. While a background subagent or workflow is still running, it only warns.                                              |
| [`pre-push`](pre-push)                   | Before any `git push`, by anyone                         | Runs the type check and lint, for agents and people working outside Claude Code.                                                                                                                                                                                                                                                                                                                                          |

Each skips anything the project doesn't have (no Prettier, no `test:changed` script, no git, no plugins enabled), so they never break a session.

The stop hook runs only when the working tree has changes, and skips a turn when the tree is exactly as it was at its last passing run, so a checkout that is always dirty isn't checked every turn. It sends Claude back once per stop, and gives each command five minutes.

While a background subagent or workflow of the session is still running, the stop hook doesn't check: the tree holds that agent's half-finished task, often a test it is failing on purpose, and the session stopping didn't write it. It shows a one-line warning instead, and checks at the first stop after the last agent finishes. Claude Code lists that work in the Stop hook's input (`background_tasks`); a version that doesn't checks every time.

After a shell command, the edit hook checks the files in `git status` that changed while the command ran, up to 20 of them. It needs the `PreToolUse` entry in `settings.hooks.json`, which notes when each command starts. Its "unused" errors mid-change are expected when an import is added before the code that uses it; its message says so, rather than hiding them, because one left at the end is a real slip. On Windows, the edit hook refuses a file whose path has a character `cmd.exe` acts on (`& | < > ^ % ! " ( )`), rather than pass it to the shell.

## Using them

1. Copy all six files (the four hooks, and `checks.mjs` and `project-config.mjs`, which the edit and stop hooks share) into the project's `.claude/hooks/`. Then write the project's [`.claude/playbook.json`](../project) with its commands; a project file that can't be read is reported to Claude, never skipped. Run each command in it once with `node .claude/hooks/project-config.mjs`, and fix or leave out any that fails. An older `.claude/checks.json` still works when there's no project file.
2. Merge [`settings.hooks.json`](settings.hooks.json) into the committed `.claude/settings.json`. Nothing runs without this step.
3. Keep the copies byte for byte: add `.claude/hooks/** text eol=lf` to `.gitattributes`, so a Windows checkout doesn't turn `pre-push` into a script `sh` can't run, and `.claude/hooks/` to `.prettierignore`, so the project's formatter doesn't rewrite them.
4. Wire `pre-push` into git. Without another hook manager, add `"prepare": "git config core.hooksPath .claude/hooks || true"` to `package.json`, so every install points git at the same folder; git only runs files named after its hooks, so the `.mjs` files beside it are ignored. With Husky, don't: changing `core.hooksPath` turns Husky's hooks off. Add `.husky/pre-push` with the line `sh .claude/hooks/pre-push` instead.
5. Give the project file a fast `testChanged` command: `vitest run --changed` or `jest --onlyChanged`. Keep the Stop hook's checks to what runs in seconds; the full suite belongs in CI.
6. Check they run ([rule 9](../../rules/09-checks-must-prove-they-ran.md)); a hook with a wrong path fails silently:
   - ask Claude to make a change that breaks the type check, and watch it get sent back;
   - ask Claude to add an unused import with `sed`, and watch the edit hook report it;
   - start a background subagent that leaves a failing test, and watch the stop hook warn rather than send Claude back;
   - push a branch with a type error, and watch the push get refused;
   - start a session with one enabled plugin uninstalled, and watch the warning appear;

`pre-push` saves a round trip to CI but doesn't replace it: `git push --no-verify` skips it, and instructions in `CLAUDE.md` or `AGENTS.md` asking agents to run checks get skipped in long sessions. CI stays the gate.

The tests run with `node --test templates/hooks/hooks.test.mjs`, including every hook end to end as Claude Code or git runs it.
