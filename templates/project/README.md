# Project config

The playbook is the same for every project: the rules, and the checks that hold an agent to them. What differs between projects goes in one short file, `.claude/playbook.json`, so the same playbook works on any stack.

**What reads it today:** the [hooks](../hooks) take their commands from it, and the [review gate](../review-gate) adds its one-way paths. `tickets`, `checks` and the version are recorded but not yet acted on: the ticket check and the runner still read GitHub issues, and nothing warns yet when a project is behind. A project without the file keeps working as before, from `.claude/checks.json` or the npm defaults.

## What goes in it

| Setting       | Required | What it says                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playbook`    | Yes      | The playbook release the project is set up against, like `"1.0.0"`. To catch up, read the [CHANGELOG](../../CHANGELOG.md) from that release upwards. Nothing updates by itself. Releases are git tags (`v1.0.0` is the first); each changelog entry from then on says which release it's in.                                                                                                          |
| `tickets`     | Yes      | Where the work comes from: `{ "source": "github" }` for GitHub issues, or `{ "source": "jira", "project": "KAN", "site": "https://example.atlassian.net" }`.                                                                                                                                                                                                                                          |
| `commands`    | `test`   | The project's own command lines: `test`, `testChanged`, `integration`, `e2e`, `coverage`, `lint`, `typecheck`, `format`, `formatCheck`. Leave out any the project doesn't have. Call the project's task runner (`make`, `just`) where it has one. Before Claude finishes a turn, the stop hook runs `formatCheck`, `lint`, `typecheck`, then `testChanged` (or `test` without it), through the shell. |
| `afterEdit`   | No       | What runs on each edited file, as in a stack pack's `checks.json`: `{ "extensions": [".go"], "run": ["gofmt", "-w", "{file}"], "fix": true }`. Without it, the edit hook formats with the project's Prettier and lints with its ESLint, where it has them.                                                                                                                                            |
| `oneWayPaths` | No       | Globs for this project's own one-way doors: auth, public API, migrations, release settings. The review gate adds them to `.github/one-way-paths` or its defaults (agent configuration, CI, dependencies), never replacing them.                                                                                                                                                                       |
| `checks`      | No       | The optional checks the project runs: `review-gate`, `criteria`, `mutation`, `dependency-audit`, `rule-check`, `lint-ratchet`. The core checks (tests, the secrets scan) always run.                                                                                                                                                                                                                  |

Start from [`playbook.example.json`](playbook.example.json). [`examples/`](examples) has one each for Go, Python, and a Node app whose tickets are in Jira.

A setting the playbook doesn't read is an error, not ignored, so a misspelt `oneWayPath` can't quietly turn a check off. The file runs commands and decides which changes need a person, so it is agent configuration: a one-way door, reviewed as code ([rule 18](../../rules/18-agent-configuration-is-code.md)).

## The reader

[`project-config.mjs`](../hooks/project-config.mjs) lives with the hooks, which copy it with them. It is dependency-free Node. `loadProjectConfig(dir)` returns the config, `null` when there is no file, or throws an error that names the file and every problem in it. `problems(config)` lists the problems without throwing, `stopCommands(config)` gives the stop hook's commands, `runCommands(config)` runs each command once, and `isBehind(project, current)` compares releases.

Run as a script, it runs every command in the file once (all but `format`, which rewrites files) and prints which pass, exiting 1 if any fails: `node .claude/hooks/project-config.mjs`, or `node .claude/hooks/project-config.mjs coverage lint` for some. Run it at setup and after changing the file. A command that fails on a clean checkout, or a coverage threshold nobody runs, is found then rather than weeks later ([rule 9](../../rules/09-checks-must-prove-they-ran.md)).

The tests run with `node --test templates/hooks/project-config.test.mjs`, and check the shipped examples too.

## Choosing commands

- **Only commands that pass now.** A command that fails on a clean checkout sends every turn back. Fix it first, or leave it out of the file and let CI run it until it's fixed; a `lint` with a backlog belongs behind the [lint ratchet](../lint-ratchet), not in the stop hook.
- **Fast enough for every turn.** The stop hook runs `formatCheck`, `lint`, `typecheck` and `testChanged`. Time them together: much over 15 seconds and every turn waits. If a whole-project lint is slow, lint only what changed, for example `git diff --name-only --diff-filter=d HEAD -- '*.ts' '*.tsx' | xargs -r npx eslint --max-warnings 0`; for TypeScript, `tsc --noEmit --incremental`.
- **`testChanged` runs only the unit tier.** It runs on every turn, in whatever state the tree is in, so it must never pick up a test written for another tier. A real-database test that `vitest --changed` finds under the unit config connects with whatever `.env` holds. Give the other tiers' files their own pattern (`*.db.test.ts`), exclude it from the unit config before the first such file is written, and make the unit setup unable to reach a database ([rule 16](../../rules/16-acceptance-tests-are-isolated-and-real.md)).
- **Line endings.** A `formatCheck` that fails only on Windows line endings is a repository setting, not a command problem: `* text=auto eol=lf` in `.gitattributes`, then renormalise once.
- **`format`** is recorded for people and the setup skill; no hook runs it, because it rewrites files.
- **`integration`** is a second test tier: tests against real services the project owns, such as its database, run with their own config (`npm run test:db`). **`e2e`** is the acceptance tier ([rule 16](../../rules/16-acceptance-tests-are-isolated-and-real.md)): the tests that drive the real thing. No hook runs either; CI does.
- **`coverage`** runs the suite with the project's coverage threshold enforced (`vitest run --coverage`, `pytest --cov --cov-fail-under=80`). Name it if the project has a threshold, so it is run at setup and in CI rather than failing unnoticed.
- **`checks`** can be left out, or written as `[]`: both mean the core checks only.
- **`oneWayPaths`**: a trailing slash means the folder and what's inside it. Nothing yet checks that each glob matches a file, so list them with `git ls-files` after writing them.
