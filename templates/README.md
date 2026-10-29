# Templates

Starting points for a new project. The project setup skill adapts them, and [docs/new-project.md](../docs/new-project.md) gives the order to apply them in.

| File                                       | What it is                                                                                                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`CLAUDE.template.md`](CLAUDE.template.md) | The structure I use for a project's root `CLAUDE.md`: commands, architecture, security boundaries with how they are verified, conventions, pointers to area rules, workflow and lessons. Under 200 lines. |
| [`RULE.md`](RULE.md)                       | One rule per file: the rule, why it matters, and how to enforce it. The [rules](../rules) folder uses it.                                                                                                 |
| [`ADR.md`](ADR.md)                         | An architecture decision record for `docs/decisions/`: context, decision, the options rejected and why, consequences. The rejected options are what stop agents re-proposing them.                        |
| [`DESIGN.md`](DESIGN.md)                   | A design for `docs/design.md`: goal, decisions as links to ADRs, shape, numbered given/when/then acceptance criteria, and the test tier.                                                                  |
| [`PLAN.md`](PLAN.md)                       | One slice of work for `docs/plans/`: the criteria it satisfies, then tasks as failing test, code, and how the effect is observed.                                                                         |
| [`GATES.md`](GATES.md)                     | A checklist for deciding which gates a project needs, starting with whether CI runs at all.                                                                                                               |
| [`settings.json`](settings.json)           | Shared Claude Code permissions: deny reads of secret files, ask before anything that reaches production, allow routine checks. Deny and ask rules beat any personal allow list.                           |
| [`hooks/`](hooks)                          | Claude Code hooks that check work in the agent's loop: format and lint after each edit, and the type check and changed tests before it finishes a turn. Dependency-free Node, tested.                     |
| [`rules/`](rules)                          | Convention templates for a project's `.claude/rules/`: API errors as RFC 9457 problem details, domain errors, structured logging and correlation IDs.                                                     |
| [`rule-check/`](rule-check)                | A dependency-free CI check that turns `CLAUDE.md` rules into failures, with tests.                                                                                                                        |
| [`lint-ratchet/`](lint-ratchet)            | Counts ESLint findings per rule for each target and fails CI if any count rises above a committed baseline. Lets stricter rules go on before the backlog is cleared. Tested with `node --test`.           |
| [`ci.yml`](ci.yml)                         | Baseline GitHub Actions CI: types, lint, rule checks and tests, then `npm audit` and a gitleaks scan of the full history. Actions pinned to commit SHAs.                                                  |
| [`dependabot.yml`](dependabot.yml)         | Weekly Dependabot updates for npm and GitHub Actions, grouped so they arrive as a few pull requests.                                                                                                      |
| [`claude-review.yml`](claude-review.yml)   | A GitHub workflow for an automatic, read-only Claude review on each pull request, using the project's own rules.                                                                                          |

## Using the rule check

1. Copy `rule-check/check-rules.js` into the project (for example `scripts/`) and write a `rules.json` based on [`rules.example.json`](rule-check/rules.example.json).
2. Run it on the existing code first. Fix false positives in the rule, by tightening the pattern or adding an `allow`, rather than by annotating application code.
3. Add it to CI: `node scripts/check-rules.js scripts/rules.json`.

It scans whole files, so calls a formatter has split across lines are caught, and it ignores comments in JavaScript and TypeScript while leaving strings alone. Run the tests with `node --test templates/rule-check/check-rules.test.js`.
