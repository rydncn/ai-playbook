# Project config

The playbook is the same for every project: the rules, and the checks that hold an agent to them. What differs between projects goes in one short file, `.claude/playbook.json`, so the same playbook works on any stack.

**Status:** this is the file and its reader. Nothing reads it yet: the hooks and the review gate move over to it next, and until then they keep reading `.claude/checks.json` and `.github/one-way-paths`.

## What goes in it

| Setting       | Required | What it says                                                                                                                                                                                                           |
| ------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playbook`    | Yes      | The playbook release the project is set up against, like `"1.0.0"`. To catch up, read the [CHANGELOG](../../CHANGELOG.md) from that release upwards. A session warns when it is behind; nothing updates by itself.     |
| `tickets`     | Yes      | Where the work comes from: `{ "source": "github" }` for GitHub issues, or `{ "source": "jira", "project": "KAN", "site": "https://example.atlassian.net" }`.                                                           |
| `commands`    | `test`   | The project's own command lines: `test`, `testChanged`, `e2e`, `lint`, `typecheck`, `format`, `formatCheck`. Leave out any the project doesn't have. Call the project's task runner (`make`, `just`) where it has one. |
| `oneWayPaths` | No       | Globs for this project's own one-way doors: auth, public API, migrations, release settings. They are added to the playbook's defaults (agent configuration, CI, dependencies), never replace them.                     |
| `checks`      | No       | The optional checks the project runs: `review-gate`, `criteria`, `mutation`, `dependency-audit`, `rule-check`, `lint-ratchet`. The core checks (tests, the secrets scan) always run.                                   |

Start from [`playbook.example.json`](playbook.example.json). [`examples/`](examples) has one each for Go, Python, and a Node app whose tickets are in Jira.

A setting the playbook doesn't read is an error, not ignored, so a misspelt `oneWayPath` can't quietly turn a check off. The file runs commands and decides which changes need a person, so it is agent configuration: a one-way door, reviewed as code ([rule 18](../../rules/18-agent-configuration-is-code.md)).

## The reader

[`project-config.mjs`](project-config.mjs) is dependency-free Node. `loadProjectConfig(dir)` returns the config, `null` when there is no file, or throws an error that names the file and every problem in it. `problems(config)` lists the problems without throwing, and `isBehind(project, current)` compares releases.

The tests run with `node --test templates/project/project-config.test.mjs`, and check the shipped examples too.
