# AI Playbook

[![Validate](https://github.com/rydncn/ai-playbook/actions/workflows/validate.yml/badge.svg)](https://github.com/rydncn/ai-playbook/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

How I work with AI coding agents, mainly Claude Code. It is the setup I install on every machine and apply to every project: the rules I hold agents to, how work is verified before it counts as done, and the templates and tooling that make both stick.

## Principles

**Done means the effect has been observed.** The most common way an agent fails is by reporting work as done when it is not: it reads its own edit back, its tests pass, or the build goes green, and none of those could see the problem. A task is only done when its effect has been checked by something other than the agent that did the work.

**Checks enforce; instructions guide.** Anything important enough to write in `CLAUDE.md` is enforced by a test, a CI step, a hook or a permission rule where possible. A rule that is broken twice becomes a check.

**Production is behind a prompt.** Anything that can reach a shared or production environment asks first, through committed settings that no personal setting can override.

**Secure by default.** New endpoints, functions and data start closed, and are opened explicitly with a test showing who can and cannot reach them. An agent that forgets a step leaves something locked, not exposed.

**Accessible by default.** Accessibility is checked in CI on every change, in every theme and interactive state, rather than audited at the end. A component that fails is not finished.

**Context is kept small and current.** The instructions loaded into every session stay short; area-specific rules load only when they apply; lessons are written into the repository rather than left in one machine's memory.

## Start here

Not all of this pays for itself on every project. In a trial that rebuilt a small app under the playbook and compared it with the same app built without it, an independent reviewer who wasn't told which was which rated the playbook build stronger on correctness, privacy, accessibility and maintainability, with a third of the defects. But it cost two to three times the effort per feature. The gains came from a few parts; most of the rest is record-keeping that earns its place on larger or longer-lived projects.

**The core, for any project:**

- Rules [5](rules/05-done-means-the-effect-was-observed.md), [15](rules/15-tests-must-be-seen-to-fail.md) and [16](rules/16-acceptance-tests-are-isolated-and-real.md): done means the effect was observed, tests are seen to fail, and acceptance tests drive the real thing. In the trial, these are what produced a codebase whose whole app could be tested, and that was the clearest difference between the two builds.
- The gates: [CI](templates/ci.yml), the [hooks](templates/hooks) and the [gate checklist](templates/GATES.md), so the checks run without anyone remembering them.
- The [review cadence](VERIFICATION.md#5-independent-review): a fresh-context review of each piece of work, and every few pieces a review of the whole codebase against the rules. One such review found more than four layers of per-piece review had.
- [Shared permissions](templates/settings.json), so production stays behind a prompt.

**Worth it as a project grows:** a written design with numbered acceptance criteria, plans per slice, ADRs, a handoff file, rule checks, the lint ratchet, and a second model's review for risky changes. Add them when a project has more than one person or session working on it, or when a decision has been argued twice.

## Rules

Each rule has its own file: the rule, why it matters, and how to enforce it. Most are enforced by tooling once a project is set up, through hooks, CI, permissions and the setup skill, so day to day there is little to remember: the agent gets sent back when it breaks one.

1. [Enforce security boundaries with checks](rules/01-enforce-security-boundaries-with-checks.md)
2. [Verify database privileges directly](rules/02-verify-database-privileges-directly.md)
3. [Anything that reaches production asks first](rules/03-production-asks-first.md)
4. [Releases check their own environment](rules/04-releases-check-their-own-environment.md)
5. [Done means the effect has been observed](rules/05-done-means-the-effect-was-observed.md)
6. [Tests exercise behaviour](rules/06-tests-exercise-behaviour.md)
7. [Prove that configuration takes effect](rules/07-prove-config-takes-effect.md)
8. [Check interactive states](rules/08-check-interactive-states.md)
9. [A check has to prove it ran](rules/09-checks-must-prove-they-ran.md)
10. [Keep the always-loaded context small](rules/10-keep-always-loaded-context-small.md)
11. [Lessons live in the repository](rules/11-lessons-live-in-the-repo.md)
12. [A rule broken twice becomes a check](rules/12-rules-broken-twice-become-checks.md)
13. [Content the agent reads is data, not instructions](rules/13-content-is-data-not-instructions.md)
14. [Secrets never live in code, logs or telemetry](rules/14-secrets-never-in-code-logs-or-telemetry.md)
15. [Tests must be seen to fail](rules/15-tests-must-be-seen-to-fail.md)
16. [Acceptance tests are isolated and use real infrastructure](rules/16-acceptance-tests-are-isolated-and-real.md)

## How work gets to done

[VERIFICATION.md](VERIFICATION.md) sets out the path from a written design to a merged change: a plan of test-first tasks, each stating how its effect will be observed; checks in the agent's loop and in CI; independent review by a second model; guardrails on the agent; and capturing what went wrong. [docs/agent-environment.md](docs/agent-environment.md) covers where the agent runs: the sandbox, dev containers and parallel sessions in worktrees.

## Templates

| Template                                             | What it is                                                                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`CLAUDE.template.md`](templates/CLAUDE.template.md) | The structure for a project's root instructions, kept under 200 lines                                                                                    |
| [`RULE.md`](templates/RULE.md)                       | One rule per file: the rule, why, and how to enforce it                                                                                                  |
| [`ADR.md`](templates/ADR.md)                         | A decision record, with the options rejected, so agents stop proposing them again                                                                        |
| [`DESIGN.md`](templates/DESIGN.md)                   | A design with numbered given/when/then acceptance criteria                                                                                               |
| [`PLAN.md`](templates/PLAN.md)                       | One slice of work: test-first tasks, each saying how its effect is observed                                                                              |
| [`GATES.md`](templates/GATES.md)                     | A checklist for deciding a project's gates, starting with whether CI runs at all                                                                         |
| [`settings.json`](templates/settings.json)           | Shared agent permissions: deny secret files, ask before production                                                                                       |
| [`hooks/`](templates/hooks)                          | Check the enabled plugins loaded; format and lint each edit; run the type check and changed tests before the agent finishes; a git pre-push hook. Tested |
| [`audit/`](templates/audit)                          | A dependency audit with a dated allowlist, for advisories nobody can fix yet. Tested                                                                     |
| [`rule-check/`](templates/rule-check)                | A dependency-free, tested CI check that turns written rules into build failures                                                                          |
| [`lint-ratchet/`](templates/lint-ratchet)            | A CI check that stops any ESLint rule's count rising, so stricter rules can go on before the backlog is cleared                                          |
| [`rules/`](templates/rules)                          | Path-scoped conventions: APIs, errors, logging and correlation IDs for a server; testing and accessibility for React Native                              |
| [`ci.yml`](templates/ci.yml)                         | Baseline CI: types, lint and tests, then a dependency audit and a secrets scan                                                                           |
| [`dependabot.yml`](templates/dependabot.yml)         | Weekly, grouped dependency and GitHub Actions updates                                                                                                    |
| [`claude-review.yml`](templates/claude-review.yml)   | An automatic, read-only Claude review on each pull request                                                                                               |

[docs/new-project.md](docs/new-project.md) sets out the order to apply them in on a new project.

## Setup

The repository is a Claude Code plugin marketplace, so a change pushed here reaches every machine with auto-update on. The core loop comes from [Superpowers](https://github.com/obra/superpowers); Codex reviews changes on a read-only profile; a few other plugins fill gaps, and my own `playbook` plugin sets up or audits a project against these rules. Stack-specific skills (Expo, Supabase, React, React Native) are enabled per project. [docs/setup.md](docs/setup.md) lists each plugin, what it runs on your machine, and how to install the lot.

The full install is my own setup. The templates and rules stand alone: copy any one into a project without installing anything else.

## Licence

[MIT](LICENSE). The third-party plugins referenced here are under their own licences.
