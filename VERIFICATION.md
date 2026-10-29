# How work gets to done

Nothing counts as done until its effect has been checked by something other than the agent that did the work. This is how that works in practice.

## 1. Design before code

Non-trivial work starts with a short written design, built with Superpowers' brainstorming step. For a plan that already exists, a grilling skill asks one question at a time until each branch has been tested. Agents build from the written design and plan.

Any decision with real alternatives gets a short ADR in `docs/decisions/` ([template](templates/ADR.md)), including the options that were rejected and why. Agents lose that context between sessions; written down in the repository, it stops them proposing the same rejected options again. Changing a decision means a new ADR that replaces the old one, not a quiet change in the code.

## 2. A plan of test-first tasks

The design states its acceptance criteria as behaviour, in given/when/then form, before any code is written. Each criterion becomes an acceptance or end-to-end test against real infrastructure ([rule 16](rules/16-acceptance-tests-are-isolated-and-real.md)). The criteria are plain text in the plan; a Gherkin toolchain is only worth its upkeep when people outside the team read the specifications.

The design then becomes a plan of small tasks. Each task says how its effect will be observed before any code is written: a test, a command and its expected output, or a screenshot comparison. A task without a check is not ready to start. See [rule 5](rules/05-done-means-the-effect-was-observed.md).

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

CI only protects anything while it runs, so it is a required status check ([rule 9](rules/09-checks-must-prove-they-ran.md)). The [gate checklist](templates/GATES.md) covers what to consider for a new project.

## 5. Independent review

- OpenAI's Codex reviews every substantive change, on a read-only profile. A different model family catches somewhat different mistakes. I treat its findings as claims to verify. One study found that Codex reviewing Claude's code made it worse when its suggestions were applied without checking.
- An automatic Claude review on each pull request reads the project's own `CLAUDE.md` and rules files ([workflow template](templates/claude-review.yml)).
- A security audit before releases and after significant changes to authentication.

## 6. Guardrails on the agent

- Anything that reaches production asks first, set in shared, committed settings that no personal setting can override ([rule 3](rules/03-production-asks-first.md); [template](templates/settings.json)).
- A permission classifier blocks reading secrets, reading production data and merging.
- Where the agent runs sets how much the prompts have to do: on my machine with prompts, sandboxed for longer tasks, or in a firewalled dev container for anything unattended ([where the agent runs](docs/agent-environment.md)).
- Parallel sessions each work in their own git worktree, on one planned task, through the same gates.

## 7. Capture

When an agent gets something wrong, the lesson goes into the repository ([rule 11](rules/11-lessons-live-in-the-repo.md)). If the same rule is broken twice, it becomes a check ([rule 12](rules/12-rules-broken-twice-become-checks.md)). A workflow that keeps repeating becomes a skill, built and tested with Anthropic's `skill-creator` so it is clear the skill actually changes the agent's behaviour.
