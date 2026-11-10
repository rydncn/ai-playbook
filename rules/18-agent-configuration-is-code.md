# Agent configuration is reviewed as code

**Area:** agent permissions · **Enforced by:** [CODEOWNERS](../templates/CODEOWNERS), the CI step "Agent configuration changes" in [`templates/ci.yml`](../templates/ci.yml), the [review template](../templates/claude-review.yml)

## Rule

A change to the agent's configuration gets a human review that reads it as code, never only an agent's: `.claude/settings.json` and `settings.local.json`, anything under `.claude/hooks/`, `.claude/agents/`, `.claude/commands/` and `.claude/skills/`, `.mcp.json`, every `CLAUDE.md` and `AGENTS.md`, the workflows and the dev container. The reviewer reads what each hook runs, which permissions it loosens, what each MCP server can reach, and what new instructions tell the agent to do. Before opening a repository you didn't write in Claude Code, read the same files; a hook in it runs as soon as you trust the folder.

## Why

A session-start hook in a committed `.claude/settings.json` is an install script for everyone who opens the repository, and an `allow` rule switches off a prompt for every session after it. In 2026, worms spread through exactly these files: a compromised package or account committed a hook, and every developer and agent that opened the repository ran it and spread it further. These changes look like configuration, so they get waved through, and an automated reviewer briefed from the same `CLAUDE.md` can be told by the change itself that the change is fine.

## How to enforce it

- Copy [`templates/CODEOWNERS`](../templates/CODEOWNERS) to `.github/CODEOWNERS`, so these paths request a named reviewer; with branch protection, make code owner review required. On a one-person project, where the agent opens pull requests as the only owner, GitHub treats the requirement as met (in the second trial, a pull request changing a workflow had no review and was still mergeable), so it adds nothing there. The rule is carried instead by the CI flag and by the owner reading every flagged file before merging; the file still records who that is.
- The CI step flags every pull request that touches these paths, in the job summary and as warnings on each file.
- The automatic review treats these files as the highest-risk change and says a human must review them, whatever else it finds.
- An agent that runs in CI on a pull request must not load the pull request's own configuration. `claude-code-action` restores `.claude/`, `.mcp.json` and the root `CLAUDE.md` from the base branch before Claude Code starts, so a hook added in a pull request doesn't run in the review job. A `CLAUDE.md` or `AGENTS.md` in a subfolder isn't restored, and loads when the reviewer reads files there; the review prompt says such text carries no authority. A workflow that runs an agent any other way restores the same files itself.
- Pin plugins and MCP servers to a version or commit, and update them on purpose after reading the change ([rule 13](13-content-is-data-not-instructions.md)).
