# Changelog

Newest first. Each entry names the commit it follows and says what a project set up against an earlier commit should do about it. A project records the commit it was set up against in its `CLAUDE.md`; to catch up, read from that commit upwards.

## 2026-11-08 · after `647a602`: what's core, and React Native

- A **"Start here"** section in the [README](README.md): the core that produced the trial's gains (rules 5, 15 and 16, the gates, the review cadence, shared permissions) and what to add as a project grows. The trial put the full playbook at two to three times the effort per feature.
- [`templates/rules/react-native.md`](templates/rules/react-native.md): native modules behind adapters with contract-tested fakes, acceptance tests that drive the real app, the tree-walk accessibility gate, and the trial's React Native test lessons.

**Existing projects:** a React Native app can adopt `react-native.md` in `.claude/rules/`; check its conventions against what the project already does, and record any it departs from in an ADR.

## 2026-11-08 · after `7c7eaf0`: the end of the first trial

The rest of the first trial's feedback: a rebuild of a small Expo app across six slices, in cloud sessions.

- **Review at three distances** ([VERIFICATION.md](VERIFICATION.md)): a fresh-context review of each slice before merge; every few slices, a whole-codebase review against the rules; a different model family for risky changes. In the trial, one whole-codebase review found nine must-fix defects that four layers of per-slice review had passed.
- **A check states what it covers** ([rule 12](rules/12-rules-broken-twice-become-checks.md)), with a planted fault per place it claims to cover.
- **No branch protection** ([rule 9](rules/09-checks-must-prove-they-ran.md)): on GitHub Free with a private repository, an ADR on who merges and on what evidence. A green check proves nothing until its log has been read.
- **Cloud sessions** ([docs/agent-environment.md](docs/agent-environment.md#cloud-sessions)) install nothing from project plugin settings: install the plugins in the environment's setup script, with `set -e`. A new [`check-plugins.mjs`](templates/hooks/check-plugins.mjs) hook warns at session start when an enabled plugin is missing, and the day-one list says to start a new session after setup.
- **[`templates/audit`](templates/audit)**: `npm audit` with a dated allowlist, so an advisory nobody can fix yet doesn't turn the gate red for good. The CI template uses it.
- **The review template**: the federation subject in GitHub's ID form, purchased credit, the green skip on the pull request that adds the workflow, and how to find out why a review failed.
- **CI** never cancels a run on `main`. **Dependabot** leaves major versions alone.
- **The hooks** all live in `.claude/hooks/`, `pre-push` included, with `core.hooksPath` pointing there; the README and the tests now agree.
- **Plans** head tasks `### Task N:`, the shape Superpowers' scripts read.
- **GATES.md**: mutation testing confirmed under `jest-expo`; `eslint-plugin-react-native-a11y` dropped (no ESLint 9 support) in favour of checking the rendered tree; `break-ui` on React Native; gitleaks proofs need a token it recognises.
- **The day-one list**: reconcile a generator's own agent files, a clean `npm ci` before the first push and never `--legacy-peer-deps`, and add each rule check with the folder it scans.
- **Expo hosts** for the sandbox and cloud allowlists: `docs.expo.dev`, `api.expo.dev`, `reactnative.directory`.

**Existing projects:** add a fresh-context review per slice and a periodic whole-codebase review to `CLAUDE.md`'s workflow; write each check's scope beside its rule and plant a fault per scope; on a plan without branch protection, write the ADR; for cloud sessions, add the setup script; add `check-plugins.mjs` and its `SessionStart` entry, move `pre-push` to `.claude/hooks/` and point `core.hooksPath` there; replace the audit step with `templates/audit`; copy the new concurrency block into CI so `main` isn't cancelled; add the `ignore` block to Dependabot; rename plan tasks to `### Task N:` if you use Superpowers' scripts; correct the review workflow's federation subject to the ID form.

## 2026-10-29 · after `3608bbe`: Claude review without an API key

- [`templates/claude-review.yml`](templates/claude-review.yml) authenticates with workload identity federation: each run swaps its GitHub OIDC token for a short-lived Claude token, so no API key is stored. One federation rule per repository, scoped to its pull requests; four repository variables. An API key secret remains the fallback.

**Existing projects:** create a federation rule for the repository as in the template's header, add the four repository variables, copy the template's `anthropic_*` inputs into the review workflow, and delete the `ANTHROPIC_API_KEY` secret once a review has run.

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
