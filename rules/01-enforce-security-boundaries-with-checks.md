# Enforce security boundaries with checks

**Area:** security · **Enforced by:** CI rule check

## Rule

Every security boundary in a project is written down in `CLAUDE.md` with its reason, and enforced by an automated check. For example, if the database is only reachable through server-side functions, a CI check fails on any direct query from client code.

## Why

An agent takes the shortest path to working code. If the shortest path crosses a security boundary, such as querying the database straight from a screen, the result compiles, works in development and quietly reopens the hole the boundary exists to close. An instruction makes that less likely; only a check makes it fail.

## How to enforce it

Write a rule-check entry for each boundary a script can see ([template](../templates/rule-check)). Run it on the existing code first, fix false positives in the rule rather than in application code, then add it to CI.
