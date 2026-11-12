# How work gets to done

Nothing counts as done until its effect has been checked by something other than the agent that did the work. This is how that works in practice.

The steps below are plain documents and commands. Plugins make them quicker (Superpowers runs the design, plan and test-first loop; `/playbook:init-project` runs the setup), but nothing here depends on them: a session without the plugins, or a person without Claude Code, follows the same steps by hand.

Where things live in a project:

| Path                    | What it holds                                                                     |
| ----------------------- | --------------------------------------------------------------------------------- |
| `docs/design.md`        | The design and its numbered acceptance criteria ([template](templates/DESIGN.md)) |
| `docs/decisions/`       | One ADR per decision with real alternatives ([template](templates/ADR.md))        |
| `docs/plans/NNN-*.md`   | One plan per slice of work ([template](templates/PLAN.md))                        |
| `docs/device-checks.md` | Dated observations only a device can make, for apps with a native surface         |
| `docs/handoff.md`       | Where the work is, for the next session                                           |

A larger project keeps one design per feature in `docs/designs/` instead of a single `docs/design.md`.

## 1. Design before code

Non-trivial work starts with a short written design ([template](templates/DESIGN.md)). For a design that already exists, it is questioned one point at a time until each branch has been tested; Superpowers' brainstorming and a grilling skill do this, or a reviewer by hand. Agents build from the written design and plan.

Any decision with real alternatives gets a short ADR in `docs/decisions/` ([template](templates/ADR.md)), including the options that were rejected and why. Agents lose that context between sessions; written down in the repository, it stops them proposing the same rejected options again. The design links to its ADRs rather than restating them, so there is one place to change. Changing a decision means a new ADR that replaces the old one, not a quiet change in the code.

## 2. Acceptance criteria and a plan of test-first tasks

The acceptance criteria live in the design, numbered, one given/when/then block per behaviour, written before any code. Each becomes an acceptance test that names its number, at the tier of [rule 16](rules/16-acceptance-tests-are-isolated-and-real.md) the design records. They are plain text; a Gherkin toolchain is only worth its upkeep when people outside the team read the specifications.

The design then becomes a plan, one file per slice of work that can be reviewed and merged on its own ([template](templates/PLAN.md)). Each plan names the criteria it satisfies. Tasks are headed `### Task N: <behaviour>`, which is also the shape Superpowers' plan-running scripts look for. Each task says how its effect will be observed before any code is written: the failing test, a command and its expected output, a screenshot comparison, or, for what nothing automated can see, the device check that will be recorded. A task without a check is not ready to start. See [rule 5](rules/05-done-means-the-effect-was-observed.md).

## 3. Build against the check

Each task starts with a failing test, and it has to fail for the right reason: an assertion on the missing behaviour, not an import error ([rule 15](rules/15-tests-must-be-seen-to-fail.md)). The implementation follows, and the same test then has to pass. Tests check behaviour through the public interface, never the code against itself ([rule 6](rules/06-tests-exercise-behaviour.md)). A bug fix starts with a test that reproduces the bug. The feature is done when its acceptance tests pass end to end, not when its unit tests do.

## 4. Gates

Gates are checks that run without anyone having to remember them. The first run inside the agent's loop, through Claude Code hooks ([templates](templates/hooks)): each edited file is formatted and linted as soon as it changes, and before the agent finishes a turn that changed files, the type check and the tests for changed files run. If they fail, the agent is sent back to fix them, or to say plainly that it couldn't. Problems are caught while the agent still has the context to fix them, rather than in CI after it has moved on.

On every project, CI then runs on every change:

- type checking, linting and unused-code checks, with the framework's own lint rules as errors and a [ratchet](templates/lint-ratchet) holding any backlog;
- unit tests, run once rather than in watch mode;
- acceptance tests against real services, in random order and in parallel;
- mutation testing on the files the change touches, so tests that cannot fail are found;
- a secrets scan of the full history and a dependency audit;
- rule checks for anything in `CLAUDE.md` a script can catch ([template](templates/rule-check));
- where there is a database, every migration applied to an empty database, then a check of the privileges that actually result ([rule 2](rules/02-verify-database-privileges-directly.md));
- end-to-end tests of the main journeys;
- accessibility checks in every theme and mode the product supports, including interactive states such as hover, which automated checkers miss at rest ([rule 8](rules/08-check-interactive-states.md)).

Before a release:

- a check that the release environment is complete ([rule 4](rules/04-releases-check-their-own-environment.md));
- a written test plan run on real devices.

CI only protects anything while it runs, so it is a required status check, or, on a plan without branch protection, an ADR says who merges and on what evidence ([rule 9](rules/09-checks-must-prove-they-ran.md)). The [gate checklist](templates/GATES.md) covers what to consider for a new project.

## 5. Independent review

The session that built something is the worst-placed to review it: whatever it got wrong, it got wrong for reasons that still seem right to it. Even a reviewer it starts for itself inherits its framing through the brief it writes ("review the card slice"), and reviews what was built rather than what the rules require. So review happens at three distances from the work:

- **Each slice, before merge: a fresh-context review.** A reviewer, usually a subagent, given only the diff, the design and `CLAUDE.md`, never the building session's reasoning. It reports findings verified against the code; the session fixes them test-first or records a ruling.
- **Every few slices, and before a phase ends: a whole-codebase review against the rules.** Briefed from `CLAUDE.md` and the design, not from any diff, and reading the slices together. It finds what per-slice reviews can't: surfaces that must agree but don't (a preview and what prints), rules whose checks cover less than they claim, and two documents that contradict each other. In the first trial of this playbook, four layers of per-slice review passed nine must-fix defects that one such review found; six of the nine only showed when slices were read together.
- **A different model family for risky changes.** OpenAI's Codex, on a read-only profile, for anything touching data, consent, permissions or what leaves the device. A different model catches somewhat different mistakes. I treat its findings as claims to verify: one study found that Codex reviewing Claude's code made it worse when its suggestions were applied without checking. In the first trial, Codex reviewed 11,000 lines after the fresh-context reviews had run and found one issue, which those reviews had already found and deliberately deferred; the fresh-context reviews found 30 on the same code. One run is weak evidence, so this stays a layer for risky changes on larger projects rather than part of the core.

**Every review gets the same brief,** [`templates/REVIEW.md`](templates/REVIEW.md), whichever distance it works at. Most of it is what any review checks. The part that matters most is four questions a reader of code doesn't ask unprompted: what another parser does with the input, what happens when two run at once, what a flood costs, and what one account can do to a result others rely on. In the second trial, the fresh-context reviews found 44 issues (7 must-fix) and the whole-codebase reviews 18 (5 must-fix), yet five defects passed tests and both review layers and were found by a person reading afterwards: an open redirect through a tab, a rate limit that counted after the slow work, unbounded password hashing, one account outvoting everyone, and a moderation decision that could be made twice. Each was one of those four questions, or a lifecycle the criteria described one action at a time. None of the briefs had asked. Running a slice in a fresh session instead of a long one changed neither the count of findings nor the kind of escape, so the gap is in what reviews are asked, not in how much context they carry.

**How much a human reads depends on whether the change can be undone.** Every pull request says which kind it is, and the automatic review checks the claim:

- **One-way doors**, hard or impossible to undo once merged or released: migrations and anything that deletes data, authentication and permissions, what leaves the device or the shape of a public API or URL, agent configuration ([rule 18](rules/18-agent-configuration-is-code.md)), new dependencies, and release or infrastructure settings. A human reads the diff for these files, not only the summary, and the different-model review runs on them.
- **Two-way doors**, undone by a revert: screens, copy, internal changes behind tests. The automated layers carry these; a human reads the summary and spot-checks.

Human attention goes where a mistake can't be taken back, instead of being spread thin over every line. A pull request with any one-way file is a one-way door.

Alongside them:

- An automatic Claude review on each pull request reads the project's own `CLAUDE.md` and rules files ([workflow template](templates/claude-review.yml)).
- A security audit before releases and after significant changes to authentication, deletion or anything leaving the device.

## 6. Guardrails on the agent

- Anything that reaches production asks first, set in shared, committed settings that no personal setting can override ([rule 3](rules/03-production-asks-first.md); [template](templates/settings.json)).
- A permission classifier blocks reading secrets, reading production data and merging.
- Where the agent runs sets how much the prompts have to do: on my machine with prompts, sandboxed for longer tasks, or in a firewalled dev container for anything unattended ([where the agent runs](docs/agent-environment.md)).
- Parallel sessions each work in their own git worktree, on one planned task, through the same gates.

## 7. Capture

When an agent gets something wrong, the lesson goes into the repository ([rule 11](rules/11-lessons-live-in-the-repo.md)). If the same rule is broken twice, it becomes a check ([rule 12](rules/12-rules-broken-twice-become-checks.md)). A workflow that keeps repeating becomes a skill, built and tested with Anthropic's `skill-creator` so it is clear the skill actually changes the agent's behaviour.

## 8. What the trials found

Each trial built a real app under the playbook, kept a log of what each layer caught and what it cost, and wrote down where the playbook was wrong. The playbook was changed after each.

|                                                 | First trial                                                                                                       | Second trial                                                                                                                                                                                                          | Third trial                                                                                                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What was built                                  | A small Expo app, rebuilt from an existing one                                                                    | A Go web app on Postgres, server-rendered HTML, with accounts, contributions and moderation                                                                                                                           | A Python command-line tool that imports bank statements, removes duplicates, categorises and reports                                                                                        |
| Playbook                                        | The full playbook                                                                                                 | The core only                                                                                                                                                                                                         | The top level ("personal data, accounts or money"), a fresh session per slice                                                                                                               |
| Compared with                                   | The original app, by a reviewer who wasn't told which was which: stronger on all four axes, 9 findings against 27 | Nothing built the same way; the first trial's figures                                                                                                                                                                 | **The same brief built by plain Claude Code** in the same environment without plugins, then a blind review of both against one rubric, the same 16 hostile inputs and 18 probes             |
| Result                                          |                                                                                                                   |                                                                                                                                                                                                                       | Scored 15 of 20 against 13; 1 must-fix against 2; 6 of 6 planted regressions caught by its tests against 5 of 6; 12 of 16 hostile inputs passed against 14                                  |
| Cost                                            | Two to three times the effort per behaviour                                                                       | About half an hour per acceptance criterion, records included                                                                                                                                                         | About 9 h 50 of working time against 1 h 50: about five times. Reviews, the audit, mutation testing and their fixes took 44% of it                                                          |
| Fresh-context reviews                           | 30 findings                                                                                                       | 44 findings, 7 must-fix                                                                                                                                                                                               | Run on every slice, with the brief                                                                                                                                                          |
| Whole-codebase review                           | 9 must-fix that four layers of per-slice review had passed                                                        | 18 findings, 5 must-fix                                                                                                                                                                                               | Two, the second with the full security audit (13 findings, 3 must-fix)                                                                                                                      |
| What a person found after every automated layer |                                                                                                                   | 4 design gaps before any code; 5 defects (an open redirect through a tab, a rate limit counting after the slow work, unbounded password hashing, one account outvoting everyone, a decision that could be made twice) | No person reviewed during the build; the blind review found what both missed (memory growing with the file, a truncated file accepted)                                                      |
| Main cost                                       | Record-keeping                                                                                                    | Record-keeping                                                                                                                                                                                                        | Mutation testing and reviews, then record-keeping                                                                                                                                           |
| Code                                            | Private                                                                                                           | [workspots](https://github.com/rydncn/workspots)                                                                                                                                                                      | [playbook build](https://github.com/rydncn/ledger-a), [plain build](https://github.com/rydncn/ledger-b), [blind review](https://github.com/rydncn/ledger-review/blob/main/review/report.md) |

**The controlled comparison, in the third trial.** The two builds' worst defects differ more than their scores. The plain build silently corrupted money: an unquoted `-1,234.56` was stored as income of 234.56 with the import reporting success, and its own test locked the behaviour in; it also passed a hostile statement's control characters straight to the terminal. The playbook build's worst was a feature that was hard to reach (no way to list the ids `explain` needs). It bounded, streamed and sanitised every input and survived 150 fuzzed files without a traceback, where the plain build had a quadratic parser and read files whole. But the plain build was easier to use: a README a new user could start from, an `init` command, and file exports kept private. The playbook build described its settings only inside its acceptance criteria, and it edited its copy of the brief's sample file to read a row it couldn't parse, so its tests never met the real bytes. Both exited 0 on a partial import. In short: better where mistakes cost most, worse for the person using it, at about five times the time.

What changed because of the third: a fifth review question (what the caller learns when something only partly works), the brief's inputs treated as fixtures that are never edited, user documentation as part of done, mutation testing aimed at the core rather than every changed file, the context budget checked after every tool call, and the Python pack. What the second changed: the review brief, rule 19 tested against a real lifecycle, the browser and rate-limit patterns in `rules/api.md`, hooks for any language and the Go pack, the context budget measured from the session's start, and four defects in the templates.

What the trials can't show: adoption on an existing codebase, months of upkeep, and teams. One controlled comparison on one app is evidence, not proof.

### Running a trial

- Give both builds one brief that describes the product, not acceptance criteria, and the same environment, model and Python, Node or Go version. The control's environment has no plugins: skills such as test-driven development switch themselves on, and would quietly make the control a playbook build. Its setup script fails if any are present.
- Nobody reviews either build's code until both are done; the owner merges when asked without reading, and answers both builds' questions alike. In the second trial, the owner's reviews found five defects, which would have measured the owner as well as the playbook.
- Both builds keep the same effort log, in the same columns.
- The blind reviewer gets anonymised copies in a random order, and a rubric with objective tests written before it reads either build's code. Nothing it can see names an arm of the comparison: in the third trial, a comment in the review environment's setup script said "the control build, without the playbook", and the reviewer worked out which was which. Check the anonymiser's own effects too: redacting a word lengthened a line past the linter's limit and replaced a URL with a placeholder, and the reviewer counted both against the builds.
