# Lessons live in the repository

**Area:** agent memory · **Enforced by:** the lesson skill

## Rule

When an agent gets something wrong, the lesson is written into the repository: the project's `CLAUDE.md`, or the rules file for that part of the code. It is never left only in the agent's local memory.

## Why

Claude's auto memory stays on one machine. A lesson kept only there never reaches other machines, teammates or cloud sessions, so the same mistake is made again elsewhere.

## How to enforce it

The lesson skill writes to the repository. Lessons that apply to every project become a rule in this folder, using [`templates/RULE.md`](../templates/RULE.md).
