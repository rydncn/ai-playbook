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

## Test tiers

<Which tier of rule 16 the acceptance tests run at, and what is left to device checks, with the ADR that records why.>
