# Anything that reaches production asks first

**Area:** agent permissions · **Enforced by:** committed `.claude/settings.json`

## Rule

Every project has a committed `.claude/settings.json` that makes Claude Code ask before any command that reaches a shared or production environment: database pushes, function deploys, secrets, app publishes, release scripts, `git push` and merges. It also denies reads of secret environment files.

## Why

Personal allow lists grow one "don't ask again" at a time, and broad entries such as `Bash(npm run *)` silently cover deploy scripts. Claude Code checks deny and ask rules before allow rules across every settings file, so a shared ask rule holds whatever any personal list says. An instruction in `CLAUDE.md` depends on the agent following it; a permission rule does not.

## Paid resources and public places

Two more things reach outside the project and can't be taken back: spending and publishing.

- **Anything billed by the hour** (a cloud server, a GPU, a managed database) has, before it is created: an estimate from the provider's live price and live availability (a sold-out type doubled one estimate), a named teardown that deletes it when the job ends, and a hard stop that deletes it anyway after a set time. Its token is scoped to its own project, set by the person outside the chat, and read into the process without being printed.
- **Anything posted where others can read it** (an issue, a comment or a gist on a public repository) is read by a person before it goes. Feedback from a private project to a public one once named the project and described one of its weaknesses; the settings template asks before `gh issue create`, `gh issue comment` and `gh gist create`.

## Auto mode

Auto mode, the default permission mode in recent versions of Claude Code, replaces most prompts with a classifier that blocks risky actions. It doesn't weaken this rule: ask and deny rules are checked before the classifier, so a matching command still prompts. Two limits matter. A rule matches the start of a command, so `git -C dir push origin main` slips past `Bash(git push*main*)`; and auto mode allows pushes to the default branch unless something stops them. The [pre-push hook](../templates/hooks/pre-push) refuses a push to `main` however it is spelled, and the settings ask before `--no-verify`, the way past it.

## How to enforce it

Start from [`templates/settings.json`](../templates/settings.json) and trim the ask list to the project's real commands.

Pushing a feature branch doesn't reach production, and asking before it stalls cloud and unattended sessions with nobody there to answer. The template asks before pushes that can: to `main` or `master`, a bare `git push` (which pushes whatever branch is checked out), force pushes, deletions and merges. Branch protection on `main` is the boundary behind that; the ask rules catch mistakes before they reach it. Keep personal settings in `settings.local.json`, ignored by git, and review that file now and then.
