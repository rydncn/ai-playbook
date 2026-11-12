# <Feature or project> design

<!--
Copy to docs/design.md for a project, or docs/designs/<feature>.md for a
feature. Written before the plan and before any code. Keep it short: a page
or two for a feature. The acceptance criteria are the part everything else
depends on.
-->

**Status:** draft · **Date:** <YYYY-MM-DD>

## Goal

<What this is for and who it is for, in two or three sentences. What is out of scope.>

## Decisions

Each decision with real alternatives has an ADR; this table links to them rather than repeating them.

| Decision                      | ADR                                                     |
| ----------------------------- | ------------------------------------------------------- |
| <e.g. Keep the current stack> | <link to docs/decisions/0001-keep-the-current-stack.md> |

## Shape

<The parts, how data moves between them, and where the boundaries are: what is real in tests and what is faked at the edge (rule 16). A short list or a small diagram.>

## Lifecycles

<Each thing that moves through stages (an order, a moderation item, a session, a screen's start-up), as a table: its states, the actions, and the state each action leads to or that it is refused. Derived conditions ("active", "visible") and where each is defined once. Time-based moves (expiry) and what makes them. Rule 19. Leave this out if nothing has stages.>

## Acceptance criteria

Numbered, one block per behaviour, written as what a user or caller would observe. Each becomes an acceptance test that names its number; plan tasks name the criteria they satisfy.

### AC1. <Behaviour, as a short statement>

- **Given** <the starting state, including the data>
- **When** <the action>
- **Then** <what can be observed>

### AC2. <Behaviour>

- **Given** <…>
- **When** <…>
- **Then** <…>

<Include the unhappy paths: empty, invalid, refused, offline, and the worst-case data the screen will really meet.>

<Two criteria every design has, whatever else it covers:

- Every example the brief or the user gave (a sample file, a request, a screen) is read exactly as given: a criterion each, word for word. In the third trial, one build edited its own copy of a sample row it couldn't parse, so its tests never met the real bytes, and the brief's refund went missing.
- A new user can start from the README alone: install, configure, a first run and every command, with an example. In the third trial, the build whose settings were described only in its acceptance criteria scored lowest on usability.

Before reviewing the criteria, check them from three directions:

- Each rules file that applies (`CLAUDE.md`, `.claude/rules/`): for each rule with behaviour someone could observe, which criterion proves it? A rule with none is a gap; in the second trial, a person reviewing the design found four (CSRF before sign-in, a new session at sign-in, a maximum password length, HTTPS in the release rehearsal).
- The five questions in `templates/REVIEW.md`, asked of the design: what another parser does with each input, what two at once do, what a flood costs, what one account or input can do to a result people rely on, and what the caller learns when it only partly works. Each answer that matters becomes a criterion; "one account counts once per spot" was missing from thirty criteria and was the most harmful defect the trial found.
- Each lifecycle above: every refused move is a criterion.>

## Test tiers

<Which tier of rule 16 the acceptance tests run at, and what is left to device checks, with the ADR that records why.>
