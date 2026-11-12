# AI Playbook

[![Validate](https://github.com/rydncn/ai-playbook/actions/workflows/validate.yml/badge.svg)](https://github.com/rydncn/ai-playbook/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

How I work with AI coding agents, mainly Claude Code: the rules I hold agents to, the checks that enforce them, and templates for Node, Go and Python. In a controlled trial, the same brief was built under it and by plain Claude Code, then reviewed blind: the playbook build avoided the worst defects, such as a payment silently stored as income, at about five times the working time. [The results](VERIFICATION.md#8-what-the-trials-found), including what got through.

## Principles

**Done means the effect has been observed.** The most common way an agent fails is by reporting work as done when it is not: it reads its own edit back, its tests pass, or the build goes green, and none of those could see the problem. A task is only done when its effect has been checked by something other than the agent that did the work.

**Checks enforce; instructions guide.** Anything important enough to write in `CLAUDE.md` is enforced by a test, a CI step, a hook or a permission rule where possible. A rule that is broken twice becomes a check.

**Production is behind a prompt.** Anything that can reach a shared or production environment asks first, through committed settings that no personal setting can override.

**Secure by default.** New endpoints, functions and data start closed, and are opened explicitly with a test showing who can and cannot reach them. An agent that forgets a step leaves something locked, not exposed.

**Accessible by default.** Accessibility is checked in CI on every change, in every theme and interactive state, rather than audited at the end. A component that fails is not finished.

**Context is kept small and current.** The instructions loaded into every session stay short; area-specific rules load only when they apply; each session stays under a context budget and hands off to a fresh one rather than compacting; lessons are written into the repository rather than left in one machine's memory.

## Start here

Not all of this pays for itself on every project, so pick the level that fits and leave the rest until it earns its place.

**What the trials showed.** In the third, the same brief (a Python tool that imports bank statements) was built twice, once under the playbook and once by plain Claude Code, and a reviewer compared them blind. The playbook build scored 15 of 20 against 13, and the difference was where it mattered most: the plain build silently stored a payment as income and let a hostile file write to the terminal, while the playbook build's worst defect was a feature that was hard to reach. It cost about five times the working time, mostly mutation testing and reviews, and it was harder for a new user to pick up. The first two trials, on an Expo app and a Go web app, pointed the same way. Every trial found things the playbook got wrong, and it changed after each; [VERIFICATION.md](VERIFICATION.md#8-what-the-trials-found) has all three, including what got through.

**A prototype** (a spike, a script, anything you would throw away). About an hour:

- [CI](templates/ci.yml) (or the [stack pack's](templates/stacks)) with the tests and the secrets scan, and the [hooks](templates/hooks).
- [Rule 5](rules/05-done-means-the-effect-was-observed.md): done means the effect was observed.
- The [shared permissions](templates/settings.json), so nothing reaches production without a prompt.

**A product** (people will rely on it). The core, an afternoon's setup. Everything above, and:

- Rules [15](rules/15-tests-must-be-seen-to-fail.md) and [16](rules/16-acceptance-tests-are-isolated-and-real.md): tests are seen to fail, and acceptance tests drive the real thing. They need numbered acceptance criteria and, for anything with stages, its lifecycle ([rule 19](rules/19-lifecycles-are-explicit.md)): a page of [design](templates/DESIGN.md), or the issue.
- The [review cadence](VERIFICATION.md#5-independent-review), every review briefed from [`REVIEW.md`](templates/REVIEW.md): a fresh-context review of each piece of work, a whole-codebase review every few pieces, and a person reading every one-way door. In both trials, the whole-codebase review found what per-piece reviews structurally can't.
- The agent's boundaries: non-production credentials ([rule 13](rules/13-content-is-data-not-instructions.md)), agent configuration reviewed as code ([rule 18](rules/18-agent-configuration-is-code.md)), and the stack's supply-chain settings (for npm, the [`.npmrc`](templates/npmrc)). The context budget comes with the hooks ([rule 17](rules/17-sessions-stay-under-a-context-budget.md)).

**Personal data, accounts or money.** Everything above, and:

- The five questions in [`REVIEW.md`](templates/REVIEW.md) answered for the design as well as for each review: what another parser does with the input, what two at once do, what a flood costs, what one account or input can do to a result people rely on, and what the caller learns when it only partly works. Each answer that matters becomes an acceptance criterion.
- The [API rules](templates/rules/api.md) in full, including the browser section, with the tests they describe.
- The security audit before each release, and a second model's review of the one-way doors.
- The data, container and supply-chain sections of the [gate checklist](templates/GATES.md).

**As the project grows** (more people or sessions, a decision argued twice, a long life): plans per slice, a handoff file, rule checks, the lint ratchet and mutation testing. Write an [ADR](templates/ADR.md) only where a real alternative was rejected and someone will ask why; a default needs none.

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
17. [Sessions stay under a context budget](rules/17-sessions-stay-under-a-context-budget.md)
18. [Agent configuration is reviewed as code](rules/18-agent-configuration-is-code.md)
19. [Lifecycles are explicit](rules/19-lifecycles-are-explicit.md)

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
| [`npmrc`](templates/npmrc)                           | npm supply-chain hardening: install scripts off, a minimum release age, exact versions                                                                   |
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
