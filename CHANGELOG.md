# Changelog

## 2026-10-29

First version.

- Sixteen rules in [`rules/`](rules), one per file: the rule, why it matters, and how to enforce it.
- [VERIFICATION.md](VERIFICATION.md): how work goes from a written design to a merged change.
- Templates: a `CLAUDE.md` structure, the rule file format, a gate checklist, shared agent permissions, a tested rule-check script for CI, and a Claude pull request review workflow.
- The Claude Code plugin marketplace this installs from, described in [docs/setup.md](docs/setup.md), including stack plugins enabled per project.
- A lint-ratchet template, and recommended ESLint rules in the gate checklist.
- A baseline CI workflow with a dependency audit and secrets scan, a Dependabot configuration, and [docs/new-project.md](docs/new-project.md) for the order to set a new project up in.
- Hooks that check work in the agent's loop, and [docs/agent-environment.md](docs/agent-environment.md) on the sandbox, dev containers and parallel sessions.
- An ADR template; a git pre-push hook; draft pull requests holding back the slow CI jobs; and Emil Kowalski's `break-ui` skill as an optional plugin for projects with a UI.
- Convention templates for APIs and observability: RFC 9457 problem details, domain errors, structured logging and correlation IDs.
