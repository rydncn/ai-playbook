# Changelog

Newest first. Each entry names the commit it follows and says what a project set up against an earlier commit should do about it. A project records the commit it was set up against in its `CLAUDE.md`; to catch up, read from that commit upwards.

## 2026-11-14 · after `c3ab36e`: modern web guidance, noted not adopted

The [Node pack](templates/stacks/node/README.md) mentions GoogleChrome/modern-web-guidance for browser UI, with a warning: its skill runs an unpinned npm package before every front-end task. It goes in the marketplace only after a trial ([backlog](docs/backlog.md)).

**Existing projects:** nothing to do. If you use it, pin the npm version.

## 2026-11-12 · after `d7082cc`: the first feedback from an existing codebase

The templates alone (design, plans, ADRs, the review brief) were used for one feature on a production codebase. The fifth review question found a real defect straight away (a loader that dropped a cut-short file's last line and exited 0), and the design's three-direction check and an independent review were worth their cost. What it found missing:

- **A route for using the templates alone** in [docs/new-project.md](docs/new-project.md): the playbook commit goes in the design's header, and the marketplace is kept current.
- **Spikes** in [`PLAN.md`](templates/PLAN.md): Measure, Record and Decides instead of Test, Code and Observed by, and the five questions still apply to throwaway code.
- **Slice plans that stand alone:** each quotes its criteria and names the design sections it needs, so a slice session doesn't read the whole design (rule 17).
- **Paid resources and public places** in [rule 3](rules/03-production-asks-first.md): anything billed by the hour has a live-price-and-availability estimate, a teardown and a hard stop; anything posted publicly is read by a person first. The settings template asks before `gh issue create`, `gh issue comment` and `gh gist create`, and the playbook has a feedback issue template that says not to name the project. The feedback itself was first posted naming its project.
- **The README's reader is whoever runs it,** user or operator; where nobody gave sample inputs, the fixtures are recorded real responses and an unedited cut of real input ([design template](templates/DESIGN.md)).
- **Several stacks in one repository:** scope each pack's checks to its folders ([`stacks/`](templates/stacks)).
- **Rule 13:** infrastructure work gets its own session that doesn't read untrusted input.

**Existing projects:** add the three `gh` ask rules to `.claude/settings.json`; use the plan template's quoted criteria and spike variant from the next plan on.

## 2026-11-12 · after `41b8436`: in step with Anthropic's current guidance

Checked against the [Claude Code best practices](https://code.claude.com/docs/en/best-practices) and the [auto mode reference](https://code.claude.com/docs/en/auto-mode-config).

- **Review findings:** must fix is only what affects correctness, security, data, accessibility or a stated requirement; a should-fix is optional, fixed only when small and plainly better ([`REVIEW.md`](templates/REVIEW.md), the review workflow, the CLAUDE template). Anthropic warns that a reviewer asked to find gaps always finds some, and acting on all of them over-engineers; reviews and their fixes were 44% of the third trial's time.
- **Auto mode:** ask and deny rules still prompt and block, because they run before its classifier ([rule 3](rules/03-production-asks-first.md), [docs/agent-environment.md](docs/agent-environment.md#auto-mode)). But a rule matches only a command's start, and auto mode allows pushes to the default branch, so the template [pre-push hook](templates/hooks/pre-push) now refuses a push to `main` however it is spelled (tested with four spellings), and the settings ask before `--no-verify`.
- **Built-ins where they do the job:** `/code-review` for a quick pass, `/doctor` to prune `CLAUDE.md`, `/goal` for unattended runs, and code intelligence plugins for typed languages.

**Existing projects:** copy the new `pre-push` (it refuses pushes to `main`), add `Bash(*--no-verify*)` to the ask rules, and update the review brief and workflow from the templates. With auto mode, describe trusted infrastructure in `autoMode.environment` in your user settings.

## 2026-11-12 · after `dfc984a`: what the third trial taught

The third trial was the first controlled one: the same brief built under the playbook and by plain Claude Code, then a blind review. The playbook build scored 15 of 20 against 13 and avoided the worst defect (silently storing a payment as income), at about five times the working time, and was harder for a new user to pick up. [VERIFICATION.md](VERIFICATION.md#8-what-the-trials-found) has the detail and how to run a trial fairly.

- **A fifth review question,** in [`templates/REVIEW.md`](templates/REVIEW.md), the review workflow and the design template: what does the caller learn when it only partly works? Both builds exited 0 on a partial import.
- **The brief's inputs are fixtures** ([rule 16](rules/16-acceptance-tests-are-isolated-and-real.md), the design template, the review brief): read as given, never edited so a test passes. The playbook build edited its copy of a sample it couldn't parse.
- **User documentation is part of done:** a criterion in every design, a gate, a review item, and a line in the CLAUDE template. Design documents and ADRs don't count.
- **Mutation testing aimed at the core** ([rule 15](rules/15-tests-must-be-seen-to-fail.md), GATES): the changed files whose mistakes cost most, and once over everything before a release. On every changed file it was the largest single cost and bought one planted regression in six.
- **The context budget is checked after every tool call,** not only on messages, reading only what the transcript gained since the last run. With messages only, its warnings came between 138,000 and 208,000 tokens added.
- **A draft Python pack,** [`templates/stacks/python`](templates/stacks/python), from the trial: `checks.json`, CI, `pre-push`, mutation testing on the core with mutmut, a `pip-audit` allowlist, a lockfile check, and what the trial learned.

**Existing projects:**

1. Copy the new `context-budget.mjs` into `.claude/hooks/`, and add its PostToolUse entry from `settings.hooks.json`.
2. Update `docs/review-brief.md` from `templates/REVIEW.md` (the fifth question, fixtures, user documentation), and the review workflow's prompt to match.
3. Add the two criteria every design now has: the brief's examples read as given, and a README a new user can start from.
4. If mutation testing runs on every changed file, aim it at the core: for the Python pack, set the repository variable `MUTATION_CORE`.

## 2026-11-10 · after `1da03c8`: what the second trial taught

**Defects fixed** (each proven before the fix):

- [`templates/ci.yml`](templates/ci.yml) failed as written: the Node LTS ships npm 10.9, and the npm check needs 11.10 for `min-release-age`. Each job now installs npm at an exact version.
- The secrets scan read every branch (gitleaks scans all refs by default, and `fetch-depth: 0` fetches them), so a token planted on a proof branch turned every pull request red. It now scans the history reachable from the checked-out commit (`--log-opts="HEAD"`).
- The gitleaks proof advice planted a token gitleaks ignores: an obviously fake `ghp_` token has too little entropy. [GATES.md](templates/GATES.md) and [docs/new-project.md](docs/new-project.md) now say to plant a random one, on a branch deleted straight afterwards.
- A check piped into `tee` passed when it failed. [Rule 9](rules/09-checks-must-prove-they-ran.md) says so, and the CI template sets `shell: bash`, which runs with `pipefail`.
- [`rules/api.md`](templates/rules/api.md) gave browsers raw JSON errors; a browser now gets the same problem fields as a page.
- [Rule 15](rules/15-tests-must-be-seen-to-fail.md): plant breaks on a clean tree. Undoing one with `git checkout -- file` erased uncommitted work in the trial.

**Added:**

- [`templates/REVIEW.md`](templates/REVIEW.md): one brief for every review, asking four questions by name that both review layers missed in the trial (what another parser does with the input, two at once, a flood, one account against a shared result), plus lifecycles and the door. The review workflow, the CLAUDE template, GATES and VERIFICATION point at it. The [design template](templates/DESIGN.md) checks its criteria against the rules, the four questions and the lifecycles before review.
- [`rules/api.md`](templates/rules/api.md): CSRF before sign-in; sign-up that doesn't reveal accounts; rate limits counted atomically before the slow work and shared across every route that checks a password; a password length cap and a hashing concurrency cap; redirect targets checked by parsing; one vote per account in anything combined; bounded lists; a development mail outbox. Each with the test that proves it.
- **Hooks for any language:** `after-edit.mjs` and `before-stop.mjs` read the project's commands from `.claude/checks.json` (shared code in `checks.mjs`), falling back to the npm defaults without one. A broken `checks.json` is reported, never skipped.
- [`templates/stacks/`](templates/stacks): which templates are generic and which per stack, a Node pack (the existing templates), a Go pack from the trial (CI, `checks.json`, permissions, notes), how to write one, and which rules apply to projects without a UI.
- **"Start here" in three levels:** a prototype, a product (the core), and personal data, accounts or money. The README leads with what the trials showed; [VERIFICATION.md](VERIFICATION.md) has both trials' results side by side.
- Smaller: the [ADR template](templates/ADR.md) says to write one only where a real alternative was rejected; [rule 18](rules/18-agent-configuration-is-code.md) and [CODEOWNERS](templates/CODEOWNERS) say code-owner review enforces nothing on a one-person project; [rule 17](rules/17-sessions-stay-under-a-context-budget.md) and the CLAUDE template say a handoff describes the work, with tool installs in a setup script.

**Existing projects:**

1. In CI: add the "Use npm 11" step after each `setup-node`, add `--log-opts="HEAD"` to the secrets scan, add `defaults: run: shell: bash`, and wrap file names in the agent configuration summary in code spans.
2. Copy `templates/REVIEW.md` to `docs/review-brief.md` and brief every review from it; in the review workflow, add the four questions and lifecycles as items 2 and 3.
3. Copy the new `after-edit.mjs`, `before-stop.mjs` and `checks.mjs` into `.claude/hooks/`. A project that isn't npm adds its pack's `checks.json` to `.claude/`.
4. A server that renders pages or holds accounts: work through the new `api.md` items, each with its test.
5. Check the design's criteria from the three directions the design template now lists.

## 2026-11-08 · after `8a6882d`: lifecycles are explicit

- **[Rule 19](rules/19-lifecycles-are-explicit.md):** anything with stages has one status field, one function that changes it, derived conditions such as "active" defined once, expiry made by a job or inside that definition, and a transition-table test. From a production codebase where the public map and a dashboard disagreed about which items were active, because only one checked the expiry.
- The [design template](templates/DESIGN.md) gains a **Lifecycles** section before the acceptance criteria; [GATES.md](templates/GATES.md) and the review prompt check for it.

**Existing projects:** list the lifecycles the code already has and where each derived condition is computed; where it is computed in more than one place, make it one definition and add a rule check against the rest; add a transition-table test per lifecycle.

## 2026-11-08 · after `f46009a`: the context budget counts what the session added

- [`context-budget.mjs`](templates/hooks/context-budget.mjs) counted the total, so in a cloud session, where the harness's own instructions take about 80,000 tokens before any work, it warned almost at once (found by the second trial). It now counts what the session added since its first reply, or since its last compaction, and reports the total alongside. [Rule 17](rules/17-sessions-stay-under-a-context-budget.md) says why that is a compromise.

**Existing projects:** copy the new `context-budget.mjs` over the old one.

## 2026-11-08 · after `5ec4a5a`: the core, defined

- The README's **Start here** now names the core exactly: rules 5, 15 and 16 with numbered acceptance criteria; CI with audit and secrets scan, and the hooks; the review cadence with a human on one-way doors; and the agent's boundaries (permissions, credentials, rule 18, `.npmrc`). Everything else is listed as what to add as a project grows. The second trial runs on the core.

**Existing projects:** nothing to change; a small project can drop what isn't in the core.

## 2026-11-08 · after `79ec5df`: context budget, agent configuration as code, review by door

- **[Rule 17](rules/17-sessions-stay-under-a-context-budget.md): sessions stay under a context budget,** about 100,000 tokens, then hand off to a fresh session rather than compacting. A new [`context-budget.mjs`](templates/hooks/context-budget.mjs) hook reads the size from the transcript on each message and, past the budget, tells Claude and the user; `CLAUDE_CONTEXT_BUDGET` changes it. The personal defaults say the same for projects without the hook.
- **[Rule 18](rules/18-agent-configuration-is-code.md): agent configuration is reviewed as code.** A new [`templates/CODEOWNERS`](templates/CODEOWNERS); a CI step that flags any pull request touching `.claude/`, `.mcp.json`, `CLAUDE.md`, `AGENTS.md`, the workflows or the dev container; the review prompt puts these first and says a human must read them. [docs/agent-environment.md](docs/agent-environment.md) says to read a repository's hooks before trusting a folder you didn't write. The review action restores the root agent configuration from the base branch, but not a `CLAUDE.md` in a subfolder.
- **Review by door** ([VERIFICATION.md](VERIFICATION.md#5-independent-review)): each pull request says whether it is a one-way door (hard to undo) or a two-way door, and a human reads the diff of every one-way file. The review summary names them.
- **Unattended runs** ([docs/agent-environment.md](docs/agent-environment.md#unattended-runs)): one watched iteration first, only work marked for it, a container or cloud session, a draft pull request as the output, limits on time and spend.
- **Plans** carry a status; agents build only from an active one.

**Existing projects:** copy `context-budget.mjs` into `.claude/hooks/` and add its `UserPromptSubmit` entry from `settings.hooks.json`; copy `templates/CODEOWNERS` to `.github/CODEOWNERS` with real reviewers, and add the "Agent configuration changes" step to the CI security job; in the review workflow, add the agent configuration item first and the door line to the summary; add the door line to `CLAUDE.md`'s workflow; add `**Status:**` to existing plans, marking merged ones done.

## 2026-11-08 · after `deba336`: plugin pins, workflows, containers, browser security

- **Plugins pinned to commits** in the marketplace, checked by [`scripts/plugin-pins.mjs`](scripts/plugin-pins.mjs) in CI; [docs/setup.md](docs/setup.md#what-each-plugin-runs-on-your-machine) has the update routine. Until now a push to any of the eight upstreams reached every machine on its next auto-update.
- **Workflows:** `persist-credentials: false` on every checkout in the templates, and [zizmor](https://github.com/zizmorcore/zizmor), pinned by checksum, linting them in [`templates/ci.yml`](templates/ci.yml). Its first online run found the playbook's own `# v6` comments on v7 commits; they now name the exact version.
- **Lockfile and registry:** lockfile-lint (registry hosts, HTTPS, integrity hashes) and `npm audit signatures` in the CI template's security job.
- **[GATES.md](templates/GATES.md):** audits for Go, Python, Rust and Ruby with the same dated-allowlist rule; new Workflows and Containers sections (digest-pinned minimal base, non-root, image scan, the tested image is the shipped one).
- **[`templates/rules/api.md`](templates/rules/api.md):** a section for servers that render pages: security headers and CSP, cookie flags, CSRF, sign-in rate limits, password hashing, escaping, redirects.
- **[`templates/dependabot.yml`](templates/dependabot.yml):** an optional `docker` block.

**Existing projects:** add `persist-credentials: false` to every `actions/checkout` (check first that no step pushes with the checkout's token; `claude-code-action` brings its own) and the two zizmor steps, then fix or annotate what it finds; add the lockfile-lint and signature steps to the security job; for each other language, add its audit; with a container, work through the Containers gates and uncomment the Docker block; a server that renders pages adopts the new `api.md` section, with the test it describes.

## 2026-11-08 · after `d62d6a9`: npm supply-chain hardening

- [`templates/npmrc`](templates/npmrc): install scripts off, a 7-day minimum release age, exact versions. Compromised packages spread by publishing a bad version and running code from its install script within hours; this closes both routes.
- [`templates/ci.yml`](templates/ci.yml) proves the settings take effect, including that npm is 11.10 or later: an older npm reports `min-release-age` but ignores it.
- [`templates/dependabot.yml`](templates/dependabot.yml) waits 7 days for version updates, matching the release age; security updates skip the wait.

**Existing projects:** copy `templates/npmrc` to `.npmrc` in each folder with a `package.json`; run `rm -rf node_modules && npm ci` and the checks, and for any package that stops working without its install script, run it explicitly (`npm rebuild <name>`) and record why in an ADR; add the CI step and the Dependabot `cooldown` blocks; make sure CI's Node ships npm 11.10 or later.

## 2026-11-08 · after `647a602`: what's core, and React Native

- A **"Start here"** section in the [README](README.md): the core that produced the trial's gains (rules 5, 15 and 16, the gates, the review cadence, shared permissions) and what to add as a project grows. The trial put the full playbook at two to three times the effort per feature.
- [VERIFICATION.md](VERIFICATION.md) records the trial's one cross-model review: Codex found one issue in 11,000 lines, already found by a fresh-context review.
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
