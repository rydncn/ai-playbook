---
name: init-project
description: Set up or audit a project for the playbook. Drafts or slims its CLAUDE.md from the real codebase, splits area-specific rules into path-scoped files, and adds shared permission guardrails. Use once per new project, or to review an existing project's setup.
disable-model-invocation: true
---

Set this project up for the playbook, or audit an existing setup. Don't overwrite anything without showing the user: for each file, show the new file or the diff and wait for a yes. When a file exists, propose changes to it instead. If the user isn't there to answer (a scheduled or unattended session), make the changes on a branch and open a draft pull request for review instead of waiting.

This file is also the checklist to follow by hand when the plugin isn't loaded. `docs/new-project.md` in the ai-playbook repo is the same list in order for a new repository. For an existing project set up against an earlier playbook commit, read the ai-playbook `CHANGELOG.md` from that commit and apply what each entry says existing projects should do.

## 1. Read the project first

README, package/build files, CI workflows, pre-commit hooks, review-bot config, the folder layout, a few representative source files, and any existing `CLAUDE.md`, `.claude/` folder and `docs/plans`. Note what's actually true; don't guess. Don't open env files or anything else that may hold secrets; their names are enough.

**Secrets in git.** Run `git ls-files` and look for tracked env files, key files and credentials (`.env`, `*.pem`, `*.p12`, service-account JSON). If any are tracked, stop and tell the user before anything else: untracking them doesn't remove them from history, so the keys need rotating, and the history may need rewriting. This is the most important thing this skill can find.

## 2. Check the commands an agent will run

- **Tests must exit.** If the test script runs in watch mode (`jest --watchAll`, `vitest` without `run`), add a one-shot script such as `test:ci` and point CLAUDE.md at it. An agent waiting on a watcher hangs.
- Find how to run a single test file, the typecheck, lint, and any other suites (edge functions, portal, e2e).
- **Run each one** and record whether it passes. A command written into CLAUDE.md that fails on the current code is worse than none. If you can't run it (no dependencies installed, no network), mark it `(verify)`.
- **Lockfile.** If there's no lockfile, say so: CI's `npm ci` and `npm audit` need one, so it has to be generated and committed first.

## 3. Shared guardrails in `.claude/settings.json` (committed)

Ask and deny rules beat any personal allow list, so this is what keeps every session safe. Start from `templates/settings.json` in the ai-playbook repo and trim it to the project's real commands.

- **deny** reads of real secret files: `.env`, `.env.local`, `.env.*.local`, and any app- or service-level equivalents. Committed, public-only env files can stay readable. A `Read()` deny doesn't stop a shell command such as `cat .env`, so treat it as a guard against accidents, not a boundary; the boundary is keeping production secrets off the machine the agent works on (rule 13).
- **ask** before anything that reaches a shared or production environment. Look for the project's real commands: database pushes and migration repairs, function or server deploys, secret management, OTA or app-store publishes, release scripts, `git push`, PR merges. Read the body of every `package.json` script and add an ask rule for each one that deploys, publishes or touches shared data, by its script name, e.g. `"Bash(npm run deploy*)"`: a rule on `vercel --prod` doesn't catch `npm run deploy` that wraps it. Use wildcards that catch `npx` and bare forms, e.g. `"Bash(*supabase db push*)"`. Never let a broad allow like `Bash(npm run *)` cover them.
- **allow** the safe, routine checks you found in step 2, so they don't prompt.
- Remove template entries for tools the project doesn't use, so the file reads as this project's list.

**Hooks.** Offer the two hooks from the ai-playbook repo's `templates/hooks/`: format and lint after each edit, and run the fast checks before Claude finishes a turn. Copy the scripts into `.claude/hooks/`, merge `settings.hooks.json` into the settings, and add a `test:changed` script for the project's test runner. Leave out any check that takes more than a few seconds on this project; it belongs in CI. Also offer the git `pre-push` hook from the same folder, which covers other agents and people.

**Decisions.** If the project has no `docs/decisions/`, propose one with ADRs (from `templates/ADR.md`) for the choices you found while reading that had real alternatives, especially any where the code or comments show an option was tried and dropped. Mark each `(verify)` until the user confirms the reasons.

**Sandbox.** If the user wants longer runs with fewer prompts, propose the sandbox settings in `docs/agent-environment.md`, with the network list limited to the hosts this project actually needs.

Then check `.gitignore`: personal `.claude/settings.local.json` must be ignored while `.claude/settings.json` and `.claude/rules/` stay tracked:

```gitignore
/.claude/*
!/.claude/settings.json
!/.claude/rules/
```

If `settings.local.json` is already tracked, untrack it with `git rm --cached` and warn the user to back up their local copy first, because pulling that change deletes it.

## 4. Root `CLAUDE.md`: under about 200 lines

It loads into every session, so every line should be something Claude would otherwise get wrong. Use `templates/CLAUDE.template.md` in the ai-playbook repo for the structure. Include:

- What the project is (one or two sentences).
- **Commands**: install, run, the one-shot test command, single-file test, lint, typecheck. Note which commands ask first.
- Architecture and layout, briefly.
- Rules that apply everywhere (security boundaries, branding, conventions, commit format).
- **Playbook version**: the ai-playbook commit this setup follows, so a later reader knows which changes in its `CHANGELOG.md` the project predates.
- **Docs layout**: the paths from the ai-playbook repo's `VERIFICATION.md` (`docs/design.md`, `docs/decisions/`, `docs/plans/`, `docs/handoff.md`, and `docs/device-checks.md` for a native app). Create the folders if they don't exist.
- **Workflow**: fill the template's placeholders with the tools the user actually has, for example the Superpowers flow for non-trivial work, `/codex:review` before merging, adversarial review and a security audit for risky changes, handoffs, and lessons. Leave out any the user doesn't use.
- **Lessons**: an empty section for `/playbook:lesson`.

Leave out:

- **Rules for one area of the code.** Put them in `.claude/rules/<area>.md` with `paths:` frontmatter so they load only when Claude touches matching files:

  ```markdown
  ---
  paths:
    - "supabase/**"
  ---
  ```

  Design systems, database and migration rules, and API conventions are the usual candidates. Keep each file under 40,000 characters. If the project has its own server or API, offer the convention templates in the ai-playbook repo's `templates/rules/` (problem details and domain errors; structured logging and correlation IDs). Fill them in from what the code already does. Where the code does something different, ask which way the project wants rather than writing down a convention it doesn't follow.

- **Inventories that duplicate the code** (lists of functions, endpoints, modules). They drift. Point at the folder instead.
- **Motivational or persona prose** ("ultrathink", "think different", "never the first solution that works"). It pushes towards over-engineering and contradicts the simplest-solution default.

Mark anything you're unsure of with `(verify)`.

## 5. Review layers and CI

Set up the gates and review layers described in the ai-playbook repo's `VERIFICATION.md`, using `templates/GATES.md` as the checklist:

- **Is there CI at all?** If not, propose `templates/ci.yml` and `templates/dependabot.yml` from the ai-playbook repo, trimmed to the scripts the project has, and follow `docs/new-project.md` for the order. The CI template reads the Node version from `.nvmrc`; add one or switch to `node-version`.
- **Is CI actually running?** Check the recent workflow runs, with `gh api repos/<owner>/<repo>/actions/runs` or the GitHub MCP tools, whichever the session has. If jobs fail, read why before assuming it's the code: jobs that never start (billing, disabled workflows) mean nothing is being checked. Recommend making every CI job a required status check on the main branch, including `Tests` when the CI is draft-aware. If neither route can reach the remote, report this as not checked rather than skipping it silently.
- **Dependency audit and secrets scan.** If CI has neither, propose the `security` job from `templates/ci.yml`.
- **Tests.** Look at a sample of the existing tests for the patterns in rules 6, 15 and 16: tests that assert on mocks of the project's own code, tests that can't fail, acceptance tests against mocked databases, and tests that share state. Report what you find with examples; don't rewrite tests without asking.
- **Credentials and telemetry.** Note which credentials an agent session can read and whether any reach production (rule 13), and whether logging, error reporting and analytics scrub secrets and personal data (rule 14). Report gaps; don't change application code for them without asking.
- **Rule checks in CI.** For each hard rule in CLAUDE.md that a script can check (forbidden calls in certain folders, forbidden strings in user-facing text), propose a CI step using `templates/rule-check/` from the ai-playbook repo, with a `rules.json` for this project. Start `rules.json` from scratch or remove every example rule and folder that doesn't apply: the check fails a rule that scans no files. Run it on the current code first. False positives get fixed in the check, not suppressed in app code. Real violations get reported to the user, and the CI step waits until they're fixed, so it never goes in red. Don't duplicate a check CI already does in another form.
- **Lint strictness.** Check whether the framework's own lint rules (for React, `eslint-plugin-react-hooks` v7 including `set-state-in-effect`) are on, and as errors. Agents treat warnings as noise. If switching them to errors would break on an existing backlog, propose `templates/lint-ratchet/` from the ai-playbook repo so nothing gets worse while the backlog is cleared. Suggest relevant rules from the lint section of `templates/GATES.md`. Never add an ESLint plugin without updating the lockfile in the same change.
- **Stack skills.** Register the skills for this project's stack in the shared `.claude/settings.json` (`extraKnownMarketplaces` and `enabledPlugins`), as described in the ai-playbook repo's `docs/setup.md`, so every session on the repository gets them. Flag any retired skill the user still has installed, such as `next-best-practices`.
- **Claude PR review.** If there's no automatic PR reviewer, propose the `templates/claude-review.yml` workflow from the ai-playbook repo, with the project's own rules files and highest-risk checks filled into its prompt. Pin the action to a commit SHA if the repo pins others. Tell the user the admin steps from the template's header: install the Claude GitHub App, create a workload identity federation rule scoped to this repository's pull requests, and add the four repository variables. An API key secret is only the fallback. Until one of them is in place, the review job fails on every pull request, so say so.
- **Existing review bots.** Check their instructions match how the project actually works (for example, not checking RLS when RLS isn't the security boundary). If the user has stopped using one, remove its config.
- **PR template.** Add a review section if there isn't one: the automatic Claude review, a local Codex review, and adversarial review plus security audit for auth, data, permission or migration changes.

## 6. Lessons in the repo, not only in memory

If code comments or the user mention lessons that aren't written anywhere in the repo (for example, ones that live only in Claude's local auto memory), add them to the Lessons section or the matching rules file, so every machine and cloud session gets them.

## 7. Report

Lead with anything that needs action outside the repository: tracked secrets, CI that isn't running, rule violations in the current code. Then show what you changed or propose to change, with the line count of CLAUDE.md before and after. List every `(verify)` item. A wrong CLAUDE.md is worse than none.
