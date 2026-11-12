# <Project name>

<!--
Root CLAUDE.md template. This file loads into every session, so keep it under
about 200 lines and include only what the agent would otherwise get wrong.
Rules for one part of the codebase go in .claude/rules/<area>.md with paths:
frontmatter, which load only when the agent works on matching files.
Leave out lists the code already holds (functions, endpoints, modules) and
any motivational prose. Delete these comments when you're done.
-->

<One or two sentences: what this is and who uses it.>

Set up against ai-playbook `<commit>`. Its `CHANGELOG.md` lists what changed since, and what to do about each change.

Docs: design and acceptance criteria in `docs/design.md`, decisions in `docs/decisions/`, plans in `docs/plans/` (build only from one marked active; done plans are history), where the work is in `docs/handoff.md`.

## Commands

```bash
<install>                 # Install
<run>                     # Run locally
<test once>               # Run all tests ONCE (never a watch-mode command)
<test one file>           # Run a single test file
<lint>                    # Lint and format check
<typecheck>               # Type check
<rule checks>             # Project rule checks (see templates/rule-check)
```

Commands that reach a shared or production environment are set to ask first in `.claude/settings.json`. Never work around that.

At the start of a session, if the plugin check reports missing plugins, tell the user before starting work rather than doing their steps by hand.

## Architecture

<A short map: the main parts, how data flows between them, and where each lives.>

Decisions and the options rejected for them are in `docs/decisions/`. Read the relevant one before proposing a different approach; to change a decision, write a new ADR that replaces it.

### Security boundaries

<!-- Where a rule is checked, name the check and what it covers, e.g. "checked by the wording test (domain text, screen text, every translation) and the no-acceptance-words rule (every string literal under src/)". A check that covers less than it claims is worse than none. -->

<The rules that protect users and data, each with the reason. For example: client code never queries the database; every write goes through a server-side function that checks the token, rate-limits and validates input. Describe how the boundary is verified, not just what it is.>

## Conventions

- <Language and type rules>
- <Naming and file layout>
- Commits: <format, e.g. conventional commits with the ticket ID>

## Area rules

These load automatically when the agent works on matching files:

- `.claude/rules/<area>.md`: <what it covers, e.g. database, migrations and server functions>
- `.claude/rules/<area>.md`: <e.g. design system and accessibility>

## Workflow

- Non-trivial work: written design, then a plan of test-first tasks. Each task states how its effect will be checked before any code is written.
- Every pull request says whether it is a one-way door (migrations, data deletion, auth, public API, agent configuration, new dependencies, release settings) or a two-way door. A human reads the diff of every one-way file before merging.
- Documentation for users is part of done: a new user can start from the README alone. Design documents and ADRs are for maintainers.
- A task is done when its effect has been observed, not when the code has been read back.
- Before merging: a fresh-context review of the slice (a reviewer given the diff, the design and this file, not the session's reasoning), briefed with `docs/review-brief.md` (from the playbook's `templates/REVIEW.md`), which asks the five questions by name. For auth, data, permission or migration changes: <deeper review, e.g. a different model family, and a security audit>.
- Every few slices: a review of the whole codebase against these rules, reading the slices together, with the same brief.
- When the context budget warns, finish the step and write the handoff (`docs/handoff.md`): where the work is, what's next, what's undecided. Tools the next session needs go in a setup script it runs, never in the handoff as "installed": a fresh session may start in a fresh container.
- When the agent gets something wrong, record the lesson here or in the matching rules file, never only in local memory. If a rule is broken twice, turn it into a check.

## Lessons

<!-- One line each, specific, with the command, path or name. Add with the lesson skill. -->
