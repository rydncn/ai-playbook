# How work gets to done

Nothing counts as done until its effect has been checked by something other than the agent that did the work. This is how that works in practice.

## The path

Three sets of plugins each come with a flow of their own. This is the one path through them; where two offer the same step, this table says which one the playbook uses. Each step is also plain documents and commands, so a session without the plugins, or a person without Claude Code, follows the same path by hand.

| Step                                                          | Use                                                                                                                                                                                           | Not                                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Set up or audit a project                                     | `/playbook:init-project`, or [docs/new-project.md](docs/new-project.md) by hand                                                                                                               |                                                                                      |
| [Design](#1-design-before-code)                               | `/playbook:design`: an interview, one question at a time, into the [design template](templates/DESIGN.md) with numbered criteria. Superpowers' brainstorming before there's an idea to design | A design kept only in the conversation                                               |
| Question an existing design                                   | Matt Pocock's `grill-me`, one point at a time                                                                                                                                                 |                                                                                      |
| [Plan](#2-acceptance-criteria-and-a-plan-of-test-first-tasks) | `/playbook:slices`, into [slice issues](templates/tickets). Without a queue, Superpowers' writing-plans in the [plan template's](templates/PLAN.md) shape                                     |                                                                                      |
| [Build](#3-build-against-the-check)                           | Superpowers' test-driven development and plan execution, one task per session                                                                                                                 |                                                                                      |
| [Review](#5-independent-review)                               | The CI review with the [brief](templates/REVIEW.md), and its gate                                                                                                                             | A second in-session reviewer on a two-way slice; `/code-review` is only a quick pass |
| Hand over to a fresh session                                  | Matt Pocock's `handoff`, into `docs/handoff.md`                                                                                                                                               | An ad hoc "next session" note                                                        |
| [Capture](#7-capture) what went wrong                         | `/playbook:lesson`, and `retro` at the end of a phase                                                                                                                                         | Claude's auto memory alone                                                           |
| Before a release                                              | Cloudflare's `security-audit`                                                                                                                                                                 |                                                                                      |

## Where things live

| Path                    | What it holds                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `docs/design.md`        | The design and its numbered acceptance criteria ([template](templates/DESIGN.md))                                 |
| `docs/decisions/`       | One ADR per decision with real alternatives ([template](templates/ADR.md))                                        |
| `docs/plans/NNN-*.md`   | One plan per slice of work ([template](templates/PLAN.md)), or one issue per slice ([tickets](templates/tickets)) |
| `docs/device-checks.md` | Dated observations only a device can make, for apps with a native surface                                         |
| `docs/handoff.md`       | Where the work is, for the next session                                                                           |

A larger project keeps one design per feature in `docs/designs/` instead of a single `docs/design.md`.

## 1. Design before code

Non-trivial work starts with a short written design ([template](templates/DESIGN.md)). For a design that already exists, it is questioned one point at a time until each branch has been tested; Superpowers' brainstorming and a grilling skill do this, or a reviewer by hand. For a new design, [`/playbook:design`](plugins/playbook/skills/design/SKILL.md) interviews the person the same way and writes it from the template, and [`/playbook:slices`](plugins/playbook/skills/slices/SKILL.md) splits it into slice issues. Agents build from the written design and plan.

Any decision with real alternatives gets a short ADR in `docs/decisions/` ([template](templates/ADR.md)), including the options that were rejected and why. Agents lose that context between sessions; written down in the repository, it stops them proposing the same rejected options again. The design links to its ADRs rather than restating them, so there is one place to change. Changing a decision means a new ADR that replaces the old one, not a quiet change in the code.

## 2. Acceptance criteria and a plan of test-first tasks

The acceptance criteria live in the design, numbered, one given/when/then block per behaviour, written before any code. Each becomes an acceptance test that names its number, at the tier of [rule 16](rules/16-acceptance-tests-are-isolated-and-real.md) the design records. They are plain text; a Gherkin toolchain is only worth its upkeep when people outside the team read the specifications.

The design then becomes a plan, one per slice of work that can be reviewed and merged on its own: a file ([template](templates/PLAN.md)), or, where agents take work from a queue, an issue made from the [slice form](templates/tickets), which adds a mode (`afk` or `hitl`), its blockers, and a check that says when it's ready for an agent. Each plan names the criteria it satisfies. Tasks are headed `### Task N: <behaviour>`, which is also the shape Superpowers' plan-running scripts look for. Each task says how its effect will be observed before any code is written: the failing test, a command and its expected output, a screenshot comparison, or, for what nothing automated can see, the device check that will be recorded. A task without a check is not ready to start. See [rule 5](rules/05-done-means-the-effect-was-observed.md).

## 3. Build against the check

Each task starts with a failing test, and it has to fail for the right reason: an assertion on the missing behaviour, not an import error ([rule 15](rules/15-tests-must-be-seen-to-fail.md)). The implementation follows, and the same test then has to pass. Tests check behaviour through the public interface, never the code against itself ([rule 6](rules/06-tests-exercise-behaviour.md)). A bug fix starts with a test that reproduces the bug. The feature is done when its acceptance tests pass end to end, not when its unit tests do.

Where the behaviour already exists and the new test passes first time, the task proves the test bites instead: a deliberate break, the failure it produced, and the break undone by an edit. That output is the evidence, for a person or a subagent alike.

**With subagents.** A session can hand tasks to subagents, naming the model for each ([arm E](docs/trials/ablation.md) of the trial measures which choice pays). In one working tree:

- **One implementer at a time.** Two agents editing the same tree see each other's half-finished work in every test run and every hook. Implementers that run side by side each get their own git worktree.
- **A read-only reviewer alongside is fine** if it reads commits (`git show <hash>:<path>`), never the working tree, which holds the implementer's planted breaks. Brief a background automated review the same way.
- **Commits one at a time, by one agent,** each after the type check passes. lint-staged and similar pre-commit tools stash unstaged changes while they run, so a commit while another agent is editing takes that agent's changes out of the tree mid-task and puts them back afterwards, or fails to. The brief says which trailer to use: the model that wrote the change, so a subagent's commits name its model, not the orchestrator's.
- **Brief by group.** A plan's tasks go to a handful of implementer briefs, each with one reviewer checking the spec first, then quality. Ask reviewers "would this test still pass if …?" rather than "review the diff", and implementers what only a real browser can show.
- **Each fix round gets its own review,** since fixes bring bugs of their own. A finding that arrives while an implementer is still building goes to it as a message, which is cheaper than another round. Fix what the change made worse or left inconsistent; report, rather than fix, older problems in authentication or anything that needs a product decision.
- **Ask each for evidence:** the failing run, the passing run, or the planted break and its failure, and count tests from the runner's totals. A subagent's report says what it did, not what it missed; it is not a review, and the fresh-context review still runs ([§5](#5-independent-review)).

The stop hook only warns while background agents are running, since the tree holds their work in progress; it checks at the first stop after they finish, and doesn't send the session back twice for the same tree ([hooks](templates/hooks)).

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

- **Each slice, before merge: a fresh-context review.** A reviewer given only the diff, the design and `CLAUDE.md`, never the building session's reasoning. Where the [review gate](templates/review-gate) is set up, this is the CI review: it runs outside the building session, so it can't inherit its framing, and its verdict decides the merge. Without it, a subagent with the brief does the job. It reports findings verified against the code; the session fixes them test-first or records a ruling.
- **Every few slices, and before a phase ends: a whole-codebase review against the rules.** Briefed from `CLAUDE.md` and the design, not from any diff, and reading the slices together. It finds what per-slice reviews can't: surfaces that must agree but don't (a preview and what prints), rules whose checks cover less than they claim, and two documents that contradict each other.
- **A different model family for risky changes.** OpenAI's Codex (the optional `codex` plugin), on a read-only profile, for one-way doors touching data, consent, permissions or what leaves the device. A different model catches somewhat different mistakes, but the gain is small ([Greptile](https://greptile.com/blog/model-inversion) measured about 2 to 3 points of serious bugs caught), and Codex reviewing Claude's code [made it worse](https://arxiv.org/abs/2607.21656) when its suggestions were applied without checking. So its findings are claims to verify, and it stays a layer for risky changes rather than part of the core.

**Every review gets the same brief,** [`templates/REVIEW.md`](templates/REVIEW.md), whichever distance it works at. Most of it is what any review checks. The part that matters most is five questions a reader of code doesn't ask unprompted: what another parser does with the input, what happens when two run at once, what a flood costs, what one account can do to a result others rely on, and what the caller learns when it only partly works. Defects of these kinds pass tests and reviews that weren't asked about them, so the brief asks each by name.

**How much a human reads depends on whether the change can be undone.** Every pull request says which kind it is, and the automatic review checks the claim:

- **One-way doors**, hard or impossible to undo once merged or released: migrations and anything that deletes data, authentication and permissions, what leaves the device or the shape of a public API or URL, agent configuration ([rule 18](rules/18-agent-configuration-is-code.md)), new dependencies, and release or infrastructure settings. A human reads the diff for these files, not only the summary, and the different-model review runs on them.
- **Two-way doors**, undone by a revert: screens, copy, internal changes behind tests. The automated layers carry these; a human reads the summary and spot-checks.

Human attention goes where a mistake can't be taken back, instead of being spread thin over every line. A pull request with any one-way file is a one-way door.

**The expensive layers follow the door too.** Reviews, the audit and mutation testing are most of the playbook's cost, so each runs where its findings can't be had more cheaply:

| Layer                                  | Two-way door              | One-way door                                    | Before a release                          |
| -------------------------------------- | ------------------------- | ----------------------------------------------- | ----------------------------------------- |
| Hooks, CI checks, tests                | Yes                       | Yes                                             | Yes                                       |
| CI review with the brief, and the gate | Yes                       | Yes                                             | Yes                                       |
| A person approves the commit           | No                        | Yes                                             | The written test plan on real devices     |
| Mutation testing                       | Changed files in the core | Every changed file                              | Everything changed since the last release |
| A different model's review             | No                        | Auth, data, permissions, what leaves the device | No                                        |
| Whole-codebase review                  | Every few slices          | Every few slices                                | Yes                                       |
| Security audit                         | No                        | After significant auth or deletion changes      | Yes                                       |

- **One review per slice, not two.** Where the CI review runs, the building session doesn't also start its own reviewer for a two-way slice. That subagent would read the same diff with the same brief, and inherit the builder's framing as well. Use `/code-review` while building, for its quick correctness pass.
- **Model by risk.** The CI review runs on Sonnet. For a project whose one-way doors carry money or personal data, a second review job on Opus can run only for changes that match the one-way paths.

Alongside them:

- An automatic Claude review of every ready commit reads the project's own `CLAUDE.md` and rules files, with the same brief ([workflow template](templates/claude-review.yml)). Its verdict feeds the [review gate](templates/review-gate), a required check: a two-way change with nothing to fix merges on the automated layers alone, while a must-fix finding or a one-way door (by the reviewer's reading or by the changed paths) waits for a person to approve that commit. That makes the one human gate a check rather than a habit, and it's the gate an unattended run stops at.
- Claude Code's bundled `/code-review` skill, for a quick correctness pass on the current diff in a fresh subagent. Use it freely while building; it doesn't ask the five questions, so the reviews the playbook counts on still get the brief.
- A security audit before releases and after significant changes to authentication, deletion or anything leaving the device.

## 6. Guardrails on the agent

- Anything that reaches production asks first, set in shared, committed settings that no personal setting can override ([rule 3](rules/03-production-asks-first.md); [template](templates/settings.json)).
- A permission classifier blocks reading secrets, reading production data and merging.
- Where the agent runs sets how much the prompts have to do: on my machine with prompts, sandboxed for longer tasks, or in a firewalled dev container for anything unattended ([where the agent runs](docs/agent-environment.md)).
- Parallel sessions, and implementing subagents that run side by side, each work in their own git worktree, on one planned task, through the same gates.

## 7. Capture

When an agent gets something wrong, the lesson goes into the repository ([rule 11](rules/11-lessons-live-in-the-repo.md)). If the same rule is broken twice, it becomes a check ([rule 12](rules/12-rules-broken-twice-become-checks.md)). A workflow that keeps repeating becomes a skill, built and tested with Anthropic's `skill-creator` so it is clear the skill actually changes the agent's behaviour.
