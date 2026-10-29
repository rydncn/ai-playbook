# Starting a new project

This is the one ordered list of what the playbook asks for on day one. Each item links to the rule or template behind it; read those when an item needs explaining, not before. The order matters: the gates go in before the agent writes much code, so nothing it writes lands without them, and each step is small now and expensive to retrofit later.

`/playbook:init-project` works through steps 4 to 6 for you. Without the plugin, its [skill file](../plugins/playbook/skills/init-project/SKILL.md) is the same checklist to follow by hand.

## 1. Repository and scaffold

- [ ] Create the repository with a `main` branch and a licence if it will be public.
- [ ] If the framework has a generator (`create-expo-app`, `create-next-app`, `npm create vite`), run it first. It decides the scripts, TypeScript and ESLint configuration and the lockfile; the steps below then adjust what it made rather than writing it by hand.
- [ ] `.gitignore` covers `.env*`, except committed, secret-free files such as `.env.example` ([rule 14](../rules/14-secrets-never-in-code-logs-or-telemetry.md)).
- [ ] `.nvmrc` with the Node version, and the lockfile committed: CI's `npm ci` and `npm audit` need both.
- [ ] `package.json` scripts with the names CI and the hooks expect: `typecheck`, `lint`, `test:ci` (runs once and exits; a watch-mode `test` never finishes when an agent runs it), `test:changed` (the tests for changed files, for the Stop hook) and `scan:secrets` (`gitleaks git --redact --verbose`).
- [ ] The docs layout from [VERIFICATION.md](../VERIFICATION.md): `docs/design.md`, `docs/decisions/`, `docs/plans/`, `docs/handoff.md`, and `docs/device-checks.md` for an app with a native or hardware surface.

## 2. CI

- [ ] [`templates/ci.yml`](../templates/ci.yml) to `.github/workflows/ci.yml`: types and lint on every push, tests once a pull request is ready for review, then a dependency audit and a secrets scan of the full history.
- [ ] [`templates/dependabot.yml`](../templates/dependabot.yml) to `.github/dependabot.yml`.
- [ ] Open a first pull request and watch every job run and pass. Then break each gate on purpose (a type error, a lint error, a failing test, a fake secret) and watch it fail. A gate that has never been seen to fail hasn't been shown to work ([rule 9](../rules/09-checks-must-prove-they-ran.md), [rule 15](../rules/15-tests-must-be-seen-to-fail.md)).

## 3. Branch protection

- [ ] Protect `main`: pull requests only, no force pushes, and all three CI jobs as required checks. `Tests` must be required itself, not only `Types and lint`, or a draft marked ready could merge on a stale run.
- [ ] Turn on secret scanning and push protection where the plan offers them.

## 4. Agent permissions and environment

- [ ] [`templates/settings.json`](../templates/settings.json) to `.claude/settings.json`, trimmed to the project's real commands: deny secret files, ask before anything that reaches production ([rule 3](../rules/03-production-asks-first.md)).
- [ ] `.claude/settings.json` and `.claude/rules/` committed; `settings.local.json` ignored.
- [ ] Decide where the agent runs: prompts, the sandbox, or a dev container ([agent-environment.md](agent-environment.md)). Agent credentials are non-production ([rule 13](../rules/13-content-is-data-not-instructions.md)).
- [ ] The stack plugins the project uses, enabled in `.claude/settings.json` ([setup.md](setup.md)).

## 5. Checks in the agent's loop

- [ ] The two Claude Code hooks and the git pre-push hook from [`templates/hooks`](../templates/hooks).
- [ ] Break the type check on purpose and watch the agent get sent back, and watch a push get refused.

## 6. Instructions and decisions

- [ ] `CLAUDE.md` from [`templates/CLAUDE.template.md`](../templates/CLAUDE.template.md), under 200 lines ([rule 10](../rules/10-keep-always-loaded-context-small.md)), recording the playbook commit it was set up against.
- [ ] The first ADRs, for the stack and anything else chosen between real alternatives ([template](../templates/ADR.md)), including which tier of acceptance test the project runs ([rule 16](../rules/16-acceptance-tests-are-isolated-and-real.md)).
- [ ] For a project with its own server, the [convention templates](../templates/rules) in `.claude/rules/`.

## 7. Review

- [ ] [`templates/claude-review.yml`](../templates/claude-review.yml) for an automatic review on each pull request. It authenticates with workload identity federation rather than a stored API key: one federation rule per repository, scoped to its pull requests, and four repository variables. The template's header has the steps.
- [ ] A pull request template with a short checklist: how the change was verified, and whether it touches auth, data or migrations.
- [ ] Agents open pull requests as drafts while they work.

## As the project grows

- When a rule in `CLAUDE.md` is broken twice, turn it into a check with [`templates/rule-check`](../templates/rule-check) ([rule 12](../rules/12-rules-broken-twice-become-checks.md)).
- When the lint configuration gets stricter than the code, add [`templates/lint-ratchet`](../templates/lint-ratchet) rather than turning the new rules off.
- Work through [`templates/GATES.md`](../templates/GATES.md) when the project adds a database, a UI, or a release pipeline.
- When the playbook changes, read its [CHANGELOG](../CHANGELOG.md) from the commit recorded in `CLAUDE.md`: each entry says what an existing project should do about it.
