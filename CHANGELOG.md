# Changelog

Newest first. Each entry names the commit it follows and says what a project set up against an earlier commit should do about it. A project records the commit it was set up against in its `CLAUDE.md`; to catch up, read from that commit upwards.

## 2026-10-29 · after `6fea86f`: feedback from the first trial

From a trial rebuilding an app with the playbook, in a cloud session without the plugins.

- [VERIFICATION.md](VERIFICATION.md) names the plain steps the plugins automate, so the flow works without them, and a default docs layout: `docs/design.md`, `docs/decisions/`, `docs/plans/`, `docs/handoff.md`, `docs/device-checks.md`. Acceptance criteria live in the design, numbered; plans name the criteria they satisfy; the design links to ADRs rather than restating them.
- New [`templates/DESIGN.md`](templates/DESIGN.md) and [`templates/PLAN.md`](templates/PLAN.md).
- [Rule 16](rules/16-acceptance-tests-are-isolated-and-real.md) names three tiers of acceptance test (in-process, emulator or full stack, real devices), which each project needs, and covers apps with no server. Device observations go in `docs/device-checks.md`.
- [Rule 8](rules/08-check-interactive-states.md) adds the phone equivalents: pressed, selected and disabled states, font scale 2.0, and the accessibility tree.
- [`templates/settings.json`](templates/settings.json) no longer asks before every `git push`, only pushes to `main` or `master`, a bare `git push`, force pushes, deletions and mirrors, so cloud sessions can push feature branches.
- [`templates/ci.yml`](templates/ci.yml) installs gitleaks from its release with a pinned checksum instead of Docker, so the same scan runs locally, and says that `Tests` must be a required check.
- [docs/new-project.md](docs/new-project.md) is now the single ordered day-one checklist, starting with the framework's generator.
- `init-project` records the playbook commit in `CLAUDE.md`, names the GitHub MCP tools alongside `gh`, and works as a checklist by hand.

**Existing projects:** record the playbook commit in `CLAUDE.md`; split the `git push` ask rule as in the template; make `Tests` a required check if CI is draft-aware; add a `scan:secrets` script and switch CI's secrets scan to the binary; add an ADR for the acceptance-test tier; start `docs/device-checks.md` for a native app.

## 2026-10-29 · `6fea86f`

- An [ADR template](templates/ADR.md) and `docs/decisions/` in the design step.
- A git [pre-push hook](templates/hooks/pre-push).
- Draft-aware CI: the test job waits until a pull request is ready for review.
- Emil Kowalski's `break-ui` skill as an optional plugin, and data as a state in [rule 8](rules/08-check-interactive-states.md).

**Existing projects:** add `docs/decisions/` with ADRs for past decisions; copy the pre-push hook to `.githooks/` with a `prepare` script; update CI from the template and open agent pull requests as drafts; enable `break-ui@ai-playbook` if the project has a UI.

## 2026-10-29 · `714e037`: first version

- Sixteen rules in [`rules/`](rules), one per file: the rule, why it matters, and how to enforce it.
- [VERIFICATION.md](VERIFICATION.md): how work goes from a written design to a merged change.
- Templates: a `CLAUDE.md` structure, the rule file format, a gate checklist, shared agent permissions, hooks, a rule-check script, a lint ratchet, CI, Dependabot, a Claude pull request review workflow, and conventions for APIs and observability.
- The Claude Code plugin marketplace this installs from, described in [docs/setup.md](docs/setup.md), including stack plugins enabled per project.
- [docs/agent-environment.md](docs/agent-environment.md) on the sandbox, dev containers and parallel sessions.
