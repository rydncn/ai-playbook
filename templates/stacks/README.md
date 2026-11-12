# Stacks

The playbook's ideas don't depend on the language; some of its templates do. This folder says which is which, and holds a pack for each stack the playbook has been trialled on. A pack is the stack-specific half of the setup: CI, the hooks' commands, the permissions to allow, and what the trial learned. Everything else comes from the generic templates.

| Template                                                                                                                          | Generic or per stack                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Rules 1 to 19, `CLAUDE.template.md`, `DESIGN.md`, `ADR.md`, `PLAN.md`, `REVIEW.md`, `GATES.md`, `CODEOWNERS`, `claude-review.yml` | Generic. The second trial used the design template and the ADRs on Go unchanged.                                                     |
| Hooks: `check-plugins.mjs`, `context-budget.mjs`, `pre-push`                                                                      | Generic.                                                                                                                             |
| Hooks: `after-edit.mjs`, `before-stop.mjs`                                                                                        | Generic with a `.claude/checks.json` (the pack's), npm defaults without one. They need Node to run, whatever the project's language. |
| `ci.yml`, `npmrc`, `audit/`, `lint-ratchet/`                                                                                      | Node and npm.                                                                                                                        |
| `rule-check/`                                                                                                                     | Any language's files; needs Node to run.                                                                                             |
| `settings.json`                                                                                                                   | Generic deny and ask rules; the allow list is the pack's.                                                                            |
| `rules/api.md`, `rules/observability.md`                                                                                          | Generic ideas with JavaScript examples; adapt the examples.                                                                          |
| `rules/react-native.md`                                                                                                           | React Native.                                                                                                                        |

## Packs

- [`node/`](node): JavaScript and TypeScript, from the first trial (an Expo app). Its files are the top-level templates.
- [`go/`](go): Go, from the second trial (a web app on Postgres, server-rendered HTML).
- [`python/`](python): Python with `uv`, from the third trial (a command-line tool on SQLite). A draft until a second project has used it.

## Writing a pack for another stack

1. A `checks.json` for the hooks: the formatter as a `fix` entry and a fast check (a linter or `vet`) for edited files, then the stop checks: format, lint, and the tests for what changed. Call the project's existing task runner (`make`, `just`) where it has one.
2. A CI workflow with the generic jobs' shape from `ci.yml` or `go/ci.yml`: explicit `bash` (for `pipefail`), checkouts with `persist-credentials: false`, the quick checks on drafts and the tests when ready, the stack's dependency audit, the secrets scan, zizmor and the agent configuration step.
3. The allow list: the routine checks, nothing that changes anything outside the working tree.
4. The stack's equivalents for rules 15 and 16: random test order, no cached results, a race or leak detector, and mutation testing on the changed files in the core where a tool exists.
5. Prove each gate by breaking it once (rule 15), and write down what you learned in the pack's README.

A pack that hasn't been through a project is a draft. Say so at the top of its README until it has.

## Projects without a UI

A library, a command-line tool or a data pipeline keeps every rule except where it is about screens: the accessibility parts of rules and gates, `rules/react-native.md`, and the browser section of `rules/api.md`. Rule 16's acceptance tests drive the real interface instead: the command line with real files, the library's public functions, the pipeline on real sample data. The five review questions apply in full; for a tool that reads files, "what does another parser do with this input" is most of its attack surface.
