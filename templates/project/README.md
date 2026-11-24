# Project config

The playbook is the same for every project: the rules, and the checks that hold an agent to them. What differs between projects goes in one short file, `.claude/playbook.json`, so the same playbook works on any stack.

**What reads it today:** the [hooks](../hooks) take their commands from it, and the [review gate](../review-gate) adds its one-way paths. `tickets`, `checks` and the version are recorded but not yet acted on: the ticket check and the runner still read GitHub issues, and nothing warns yet when a project is behind. A project without the file keeps working as before, from `.claude/checks.json` or the npm defaults.

## What goes in it

| Setting       | Required | What it says                                                                                                                                                                                                                                                                                                                                                               |
| ------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playbook`    | Yes      | The playbook release the project is set up against, like `"1.0.0"`. To catch up, read the [CHANGELOG](../../CHANGELOG.md) from that release upwards. Nothing updates by itself.                                                                                                                                                                                            |
| `tickets`     | Yes      | Where the work comes from: `{ "source": "github" }` for GitHub issues, or `{ "source": "jira", "project": "KAN", "site": "https://example.atlassian.net" }`.                                                                                                                                                                                                               |
| `commands`    | `test`   | The project's own command lines: `test`, `testChanged`, `e2e`, `lint`, `typecheck`, `format`, `formatCheck`. Leave out any the project doesn't have. Call the project's task runner (`make`, `just`) where it has one. Before Claude finishes a turn, the stop hook runs `formatCheck`, `lint`, `typecheck`, then `testChanged` (or `test` without it), through the shell. |
| `afterEdit`   | No       | What runs on each edited file, as in a stack pack's `checks.json`: `{ "extensions": [".go"], "run": ["gofmt", "-w", "{file}"], "fix": true }`. Without it, the edit hook formats with the project's Prettier and lints with its ESLint, where it has them.                                                                                                                 |
| `oneWayPaths` | No       | Globs for this project's own one-way doors: auth, public API, migrations, release settings. The review gate adds them to `.github/one-way-paths` or its defaults (agent configuration, CI, dependencies), never replacing them.                                                                                                                                            |
| `checks`      | No       | The optional checks the project runs: `review-gate`, `criteria`, `mutation`, `dependency-audit`, `rule-check`, `lint-ratchet`. The core checks (tests, the secrets scan) always run.                                                                                                                                                                                       |

Start from [`playbook.example.json`](playbook.example.json). [`examples/`](examples) has one each for Go, Python, and a Node app whose tickets are in Jira.

A setting the playbook doesn't read is an error, not ignored, so a misspelt `oneWayPath` can't quietly turn a check off. The file runs commands and decides which changes need a person, so it is agent configuration: a one-way door, reviewed as code ([rule 18](../../rules/18-agent-configuration-is-code.md)).

## The reader

[`project-config.mjs`](../hooks/project-config.mjs) lives with the hooks, which copy it with them. It is dependency-free Node. `loadProjectConfig(dir)` returns the config, `null` when there is no file, or throws an error that names the file and every problem in it. `problems(config)` lists the problems without throwing, `stopCommands(config)` gives the stop hook's commands, and `isBehind(project, current)` compares releases.

The tests run with `node --test templates/hooks/project-config.test.mjs`, and check the shipped examples too.
