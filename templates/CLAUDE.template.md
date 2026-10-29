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

## Architecture

<A short map: the main parts, how data flows between them, and where each lives.>

### Security boundaries

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
- A task is done when its effect has been observed, not when the code has been read back.
- Before merging: <independent review step>. For auth, data, permission or migration changes: <deeper review and security audit>.
- When the agent gets something wrong, record the lesson here or in the matching rules file, never only in local memory. If a rule is broken twice, turn it into a check.

## Lessons

<!-- One line each, specific, with the command, path or name. Add with the lesson skill. -->
