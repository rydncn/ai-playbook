# Anything that reaches production asks first

**Area:** agent permissions · **Enforced by:** committed `.claude/settings.json`

## Rule

Every project has a committed `.claude/settings.json` that makes Claude Code ask before any command that reaches a shared or production environment: database pushes, function deploys, secrets, app publishes, release scripts, `git push` and merges. It also denies reads of secret environment files.

## Why

Personal allow lists grow one "don't ask again" at a time, and broad entries such as `Bash(npm run *)` silently cover deploy scripts. Claude Code checks deny and ask rules before allow rules across every settings file, so a shared ask rule holds whatever any personal list says. An instruction in `CLAUDE.md` depends on the agent following it; a permission rule does not.

## How to enforce it

Start from [`templates/settings.json`](../templates/settings.json) and trim the ask list to the project's real commands.

Pushing a feature branch doesn't reach production, and asking before it stalls cloud and unattended sessions with nobody there to answer. The template asks before pushes that can: to `main` or `master`, a bare `git push` (which pushes whatever branch is checked out), force pushes, deletions and merges. Branch protection on `main` is the boundary behind that; the ask rules catch mistakes before they reach it. Keep personal settings in `settings.local.json`, ignored by git, and review that file now and then.
