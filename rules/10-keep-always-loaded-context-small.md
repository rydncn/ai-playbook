# Keep the always-loaded context small

**Area:** agent context · **Enforced by:** project setup skill

## Rule

A project's root `CLAUDE.md` stays under about 200 lines. Rules for one part of the codebase go in `.claude/rules/` files with `paths:` frontmatter, so they load only when the agent works on matching files. Lists that repeat what the code already says, such as function inventories, are removed. Motivational prose is removed.

## Why

The root file loads into every session, and longer files cost context and reduce how closely the agent follows them. Inventories drift from the code they describe. Prose asking the agent to aim higher pushes it towards over-engineering.

## How to enforce it

Use [`templates/CLAUDE.template.md`](../templates/CLAUDE.template.md). When splitting an existing file, move sections word for word and check with a script that every line still exists somewhere.
