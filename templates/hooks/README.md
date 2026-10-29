# Hooks

Two Claude Code hooks that check the agent's work while it is working, rather than waiting for CI. They are Node scripts with no dependencies, so they run on macOS, Linux and Windows.

| Hook                                 | When it runs                                             | What it does                                                                                                                                                                                                                           |
| ------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`after-edit.mjs`](after-edit.mjs)   | After every `Edit`, `Write` or `MultiEdit`               | Formats the changed file with the project's Prettier and lints it with its ESLint. Lint errors go straight back to Claude.                                                                                                             |
| [`before-stop.mjs`](before-stop.mjs) | When Claude is about to finish a turn that changed files | Runs the `typecheck`, `lint` and `test:changed` scripts. If one fails, Claude is sent back to fix it, or to say plainly that it couldn't, instead of reporting the work as done. It sends Claude back once per stop, so it can't loop. |

Both skip anything the project doesn't have (no Prettier, no `test:changed` script, no git), so they never break a session.

## Using them

1. Copy both `.mjs` files into the project's `.claude/hooks/`.
2. Merge [`settings.hooks.json`](settings.hooks.json) into the committed `.claude/settings.json`.
3. Add a fast `test:changed` script: `vitest run --changed` or `jest --onlyChanged`. Keep the Stop hook's checks to what runs in seconds; the full suite belongs in CI.
4. Check they run: ask Claude to make a change that breaks the type check, and watch it get sent back. A hook with a wrong path fails silently ([rule 9](../../rules/09-checks-must-prove-they-ran.md)).

The tests run with `node --test templates/hooks/hooks.test.mjs`, including both scripts end to end as Claude Code runs them.
