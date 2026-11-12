# Starting a new project

This is the one ordered list of what the playbook asks for on day one. Each item links to the rule or template behind it; read those when an item needs explaining, not before. The order matters: the gates go in before the agent writes much code, so nothing it writes lands without them, and each step is small now and expensive to retrofit later.

`/playbook:init-project` works through steps 4 to 6 for you. Without the plugin, its [skill file](../plugins/playbook/skills/init-project/SKILL.md) is the same checklist to follow by hand.

**On an existing codebase, using only the templates** (a design, plans, ADRs and the review brief for one piece of work, without the hooks or the setup skill): record the playbook commit in the design's header (`Templates: ai-playbook at <commit>`), and catch up from the changelog's "Existing projects" steps for the templates you use. Keep the marketplace current: auto-update on, or `claude plugin marketplace update ai-playbook` before starting; a local copy goes stale without anything saying so.

## 1. Repository and scaffold

- [ ] Create the repository with a `main` branch and a licence if it will be public.
- [ ] If the framework has a generator (`create-expo-app`, `create-next-app`, `npm create vite`), run it first. It decides the scripts, TypeScript and ESLint configuration and the lockfile; the steps below then adjust what it made rather than writing it by hand.
- [ ] Reconcile what the generator wrote for agents. Some write an `AGENTS.md` or a `.claude/settings.json` with their own instructions and plugin choice, which can contradict the project's decisions. Keep one source: move anything worth keeping into `CLAUDE.md`, and use the plugin list from [setup.md](setup.md).
- [ ] `.gitignore` covers `.env*`, except committed, secret-free files such as `.env.example` ([rule 14](../rules/14-secrets-never-in-code-logs-or-telemetry.md)).
- [ ] `.nvmrc` with the Node version, and the lockfile committed: CI's `npm ci` and the audit need both.
- [ ] [`templates/npmrc`](../templates/npmrc) as `.npmrc`, before the first install: install scripts off, a 7-day minimum release age, exact versions. It needs npm 11.10 or later. A package that really needs its install script gets it run explicitly, with the reason in an ADR.
- [ ] For each language other than JavaScript, its audit in CI (`govulncheck`, `pip-audit`, `cargo audit`); with a container, the Containers gates in [GATES.md](../templates/GATES.md) and Dependabot's `docker` block.
- [ ] Before the first push, and after every dependency change: `rm -rf node_modules && npm ci`, then the checks. That's what CI does, and a local `npm install` can pass where it fails. Never install with `--legacy-peer-deps`: it drops other packages' peers and writes a lockfile `npm ci` refuses.
- [ ] `package.json` scripts with the names CI and the hooks expect: `typecheck`, `lint`, `test:ci` (runs once and exits; a watch-mode `test` never finishes when an agent runs it), `test:changed` (the tests for changed files, for the Stop hook) and `scan:secrets` (`gitleaks git --redact --verbose --log-opts=HEAD`).
- [ ] The docs layout from [VERIFICATION.md](../VERIFICATION.md): `docs/design.md`, `docs/decisions/`, `docs/plans/`, `docs/handoff.md`, and `docs/device-checks.md` for an app with a native or hardware surface.

## 2. CI

- [ ] [`templates/ci.yml`](../templates/ci.yml) to `.github/workflows/ci.yml`: types and lint on every push, tests once a pull request is ready for review, then a dependency audit and a secrets scan of the full history.
- [ ] On a stack other than npm, its pack from [`templates/stacks`](../templates/stacks) instead: its CI workflow, and its `checks.json` as `.claude/checks.json` for the hooks. On a stack with no pack, write one as that folder's README describes, and treat it as a draft until a project has proved it.
- [ ] [`templates/audit`](../templates/audit) to `scripts/`: the audit with a dated allowlist. A fresh scaffold can carry a high advisory nobody can fix yet; allowlist it with a reason and an expiry, rather than leaving the gate red.
- [ ] [`templates/dependabot.yml`](../templates/dependabot.yml) to `.github/dependabot.yml`. It leaves major versions for a person to plan.
- [ ] Open a first pull request and watch every job run and pass. Then break each gate on purpose (a type error, a lint error, a failing test, a fake secret) and watch it fail. For the secret, plant a random token in a format gitleaks recognises (`ghp_` followed by 36 random letters and digits). A token of the right length that is obviously fake, such as all `x`, has too little entropy to match, and gitleaks's default allowlist ignores AWS's documented example key, so either proof passes silently. Plant it on a branch you delete straight afterwards, and keep the scan to the history reachable from the checked-out commit (`--log-opts="HEAD"`, as the CI template does), or the planted token turns every other pull request red. A gate that has never been seen to fail hasn't been shown to work ([rule 9](../rules/09-checks-must-prove-they-ran.md), [rule 15](../rules/15-tests-must-be-seen-to-fail.md)).

## 3. Branch protection

- [ ] Protect `main`: pull requests only, no force pushes, and all three CI jobs as required checks. `Tests` must be required itself, not only `Types and lint`, or a draft marked ready could merge on a stale run.
- [ ] Where the plan has no branch protection (GitHub Free on a private repository), write an ADR instead: who merges, on what evidence (all three jobs green), and that CI on `main` is the backstop. The ask rules on pushing to `main` and on `gh pr merge` are then the only mechanical guard, so keep them ([rule 9](../rules/09-checks-must-prove-they-ran.md)).
- [ ] Turn on secret scanning and push protection where the plan offers them.

## 4. Agent permissions and environment

- [ ] [`templates/settings.json`](../templates/settings.json) to `.claude/settings.json`, trimmed to the project's real commands: deny secret files, ask before anything that reaches production ([rule 3](../rules/03-production-asks-first.md)).
- [ ] `.claude/settings.json` and `.claude/rules/` committed; `settings.local.json` ignored.
- [ ] Decide where the agent runs: prompts, the sandbox, or a dev container ([agent-environment.md](agent-environment.md)). Agent credentials are non-production ([rule 13](../rules/13-content-is-data-not-instructions.md)).
- [ ] The stack plugins the project uses, enabled in `.claude/settings.json` ([setup.md](setup.md)).
- [ ] For cloud sessions, the same plugins installed by the environment's setup script. Cloud sessions don't install anything from project settings ([agent-environment.md](agent-environment.md#cloud-sessions)).
- [ ] **Start a new session once this step is committed.** The session that wrote `.claude/settings.json` never has the plugins it enabled: skills load when a session starts.

## 5. Checks in the agent's loop

- [ ] The hooks from [`templates/hooks`](../templates/hooks): the plugin check at session start, the context budget on each message, format and lint after each edit, the fast checks before Claude stops, and `pre-push` for everyone else.
- [ ] [`templates/REVIEW.md`](../templates/REVIEW.md) as `docs/review-brief.md`, the brief for every review the project runs, with its five questions.
- [ ] Break the type check on purpose and watch the agent get sent back, and watch a push get refused.

## 6. Instructions and decisions

- [ ] `CLAUDE.md` from [`templates/CLAUDE.template.md`](../templates/CLAUDE.template.md), under 200 lines ([rule 10](../rules/10-keep-always-loaded-context-small.md)), recording the playbook commit it was set up against.
- [ ] The first ADRs, for the stack and anything else chosen between real alternatives ([template](../templates/ADR.md)), including which tier of acceptance test the project runs ([rule 16](../rules/16-acceptance-tests-are-isolated-and-real.md)).
- [ ] The [convention templates](../templates/rules) that fit, in `.claude/rules/`: `api.md` and `observability.md` for a project with its own server, `react-native.md` for a phone app.
- [ ] Rule checks ([`templates/rule-check`](../templates/rule-check)) for the rules a script can see. Add each one in the change that creates the folder it scans: a rule that scans nothing fails, so one added on day one for a folder that doesn't exist yet is red from the start.

## 7. Review

- [ ] [`templates/CODEOWNERS`](../templates/CODEOWNERS) as `.github/CODEOWNERS`, naming who reviews agent configuration ([rule 18](../rules/18-agent-configuration-is-code.md)).
- [ ] [`templates/claude-review.yml`](../templates/claude-review.yml) for an automatic review on each pull request. It authenticates with workload identity federation rather than a stored API key: one federation rule per repository, scoped to its pull requests, and four repository variables. The template's header has the steps, and three traps:
  - the federation rule's subject uses GitHub's ID form, `repo:<owner>@<owner id>/<repo>@<repo id>:pull_request`, not just the names;
  - federated usage needs purchased API credit; promotional credit doesn't cover it;
  - the review skips, and shows green, on the pull request that adds or changes the workflow file. Its first real run is on the next pull request, so check that one.
- [ ] A pull request template with a short checklist: how the change was verified, and whether it touches auth, data or migrations.
- [ ] Agents open pull requests as drafts while they work.
- [ ] Before merge, a fresh-context review of each slice, and every few slices a review of the whole codebase against the rules ([VERIFICATION.md](../VERIFICATION.md)).

## As the project grows

- When a rule in `CLAUDE.md` is broken twice, turn it into a check with [`templates/rule-check`](../templates/rule-check) ([rule 12](../rules/12-rules-broken-twice-become-checks.md)).
- When the lint configuration gets stricter than the code, add [`templates/lint-ratchet`](../templates/lint-ratchet) rather than turning the new rules off.
- Work through [`templates/GATES.md`](../templates/GATES.md) when the project adds a database, a UI, or a release pipeline.
- When the playbook changes, read its [CHANGELOG](../CHANGELOG.md) from the commit recorded in `CLAUDE.md`: each entry says what an existing project should do about it.
