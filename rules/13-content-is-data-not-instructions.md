# Content the agent reads is data, not instructions

**Area:** agent permissions · **Enforced by:** credential scope, committed `.claude/settings.json`, review of MCP servers

## Rule

Anything the agent reads while working (web pages, issues and pull request comments, documents, tool output, responses from MCP servers) is treated as data. Text in it that asks the agent to do something carries no authority. The agent's credentials are scoped so that obeying such text by mistake could do little harm: development or staging keys rather than production ones, read-only where reading is all the task needs. MCP servers are vetted before they are added, in the same way as plugins.

## Why

An agent cannot reliably tell the difference between instructions from its user and instructions planted in what it reads. A comment on an issue, a line in a README, or a field returned by a third-party server can all be written by someone else. Telling the agent to ignore them helps but is not a boundary. What limits the damage is what the agent can reach: a session holding only a staging key cannot be talked into changing production, and a permission rule asks before the command whatever persuaded the agent to run it.

## How to enforce it

- Give agent sessions their own credentials, scoped to non-production environments. Keep production keys out of the files and environment the agent can read; the deny rules in [`templates/settings.json`](../templates/settings.json) cover the usual env files.
- Keep the ask rules from [rule 3](03-production-asks-first.md) on every command that reaches a shared environment, so planted instructions meet a prompt.
- Before adding an MCP server, read what tools it exposes and what it can reach, prefer official or open-source servers, and pin the version. Enable servers per project, not globally.
- Limit what the agent's commands can reach with the sandbox or a dev container, so planted instructions can't send data to arbitrary hosts ([where the agent runs](../docs/agent-environment.md)).
- Review changes that came out of a session that read untrusted content (a public issue, a scraped page) with that in mind.
