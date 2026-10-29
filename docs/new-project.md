# Starting a new project

The order matters: the gates go in before the agent writes much code, so nothing it writes ever lands without them. Each step is small on day one and expensive to retrofit later.

## 1. Repository

- Create the repository with a `main` branch, a licence if it will be public, and a `.gitignore` that covers `.env*` except committed, secret-free files such as `.env.example`.
- Add `.nvmrc` with the Node version, so CI and every machine use the same one, and commit the lockfile: `npm ci` and `npm audit` both need it.
- Add the scripts CI expects to `package.json`: `typecheck`, `lint`, and `test:ci`, which runs the tests once and exits. A watch-mode `test` script never finishes when an agent runs it.

## 2. CI

- Copy [`templates/ci.yml`](../templates/ci.yml) to `.github/workflows/ci.yml`. It runs types, lint and tests, then a dependency audit and a secrets scan over the full history.
- Copy [`templates/dependabot.yml`](../templates/dependabot.yml) to `.github/dependabot.yml`.
- Open a first pull request and watch both jobs run and pass. A workflow that has never been seen to run has not been shown to work ([rule 9](../rules/09-checks-must-prove-they-ran.md)).

## 3. Branch protection

- Protect `main`: pull requests only, the CI jobs as required status checks, no force pushes.
- Turn on secret scanning and push protection in the repository's security settings where the plan offers them.
- Required checks are what make a stopped pipeline visible: if CI stops running, merges stop too.

## 4. Agent setup

- Run `/playbook:init-project`. It reads the project, writes a `CLAUDE.md` from [`templates/CLAUDE.template.md`](../templates/CLAUDE.template.md), adds the shared [`settings.json`](../templates/settings.json), and reports what it could not set up.
- Add the [hooks](../templates/hooks), including the git pre-push hook, and a fast `test:changed` script, then break the type check on purpose and watch the agent get sent back.
- Add an empty `docs/decisions/` and write the first ADRs for the stack choices ([template](../templates/ADR.md)).
- Have agents open pull requests as drafts; the CI template holds back the test job until a pull request is ready for review.
- Decide where the agent runs: prompts, the sandbox, or a dev container ([agent-environment.md](agent-environment.md)).
- Enable the stack plugins the project uses in `.claude/settings.json` (see [setup.md](setup.md)).
- Commit `.claude/settings.json` and `.claude/rules/`; keep `settings.local.json` untracked.

## 5. Review

- Add [`templates/claude-review.yml`](../templates/claude-review.yml) for an automatic review on each pull request, with the API key as a repository secret.
- Add a pull request template with a short checklist: how the change was verified, and whether it touches auth, data or migrations.

## 6. As the project grows

- When the first rule in `CLAUDE.md` is broken twice, turn it into a check with [`templates/rule-check/`](../templates/rule-check).
- When the lint configuration gets stricter than the code, add [`templates/lint-ratchet/`](../templates/lint-ratchet) rather than turning the new rules off.
- Work through [`templates/GATES.md`](../templates/GATES.md) when the project adds a database, a UI, or a release pipeline.
