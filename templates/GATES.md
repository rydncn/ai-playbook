# Gate checklist

What to consider when setting up gates for a new project. Not every item applies; the point is to decide on each rather than miss it. A gate only counts if it runs on every change, blocks a merge when it fails, and fails when it has nothing to check.

## Does CI actually run?

- [ ] CI is a required status check on the main branch. Where the plan has no branch protection (GitHub Free on a private repository), an ADR says who merges and on what evidence, and CI on `main` is the backstop ([rule 9](../rules/09-checks-must-prove-they-ran.md)).
- [ ] Recent runs have been read, including any that failed before starting.
- [ ] Every gate fails when it finds nothing to check.

## In the agent's loop

- [ ] Hooks that format and lint each edited file, and run the type check and changed tests before the agent finishes ([template](hooks))
- [ ] Seen working: a deliberate type error sends the agent back
- [ ] A git pre-push hook running the type check and lint, for tools and people outside Claude Code ([template](hooks/pre-push))
- [ ] Agents open pull requests as drafts; slow CI jobs wait until a pull request is ready for review ([CI template](ci.yml)). The quick checks still run on every push.

## Code

- [ ] Type check
- [ ] Lint and format check
- [ ] Unused files, exports and dependencies
- [ ] Unit tests, run once (not in watch mode)
- [ ] Rule checks for anything in `CLAUDE.md` a script can catch ([template](rule-check))
- [ ] The framework's own lint rules switched on as errors, not warnings. Agents treat warnings as noise.
- [ ] On an existing codebase, a lint ratchet so stricter rules can be switched on before the backlog is cleared, without anything getting worse ([template](lint-ratchet))

## Tests

- [ ] Acceptance tests against real services (containers or the platform's local stack), with fakes only for third parties ([rule 16](../rules/16-acceptance-tests-are-isolated-and-real.md))
- [ ] Tests run in random order and in parallel, so shared state fails quickly
- [ ] Mutation testing on changed files, for example Stryker in incremental mode ([rule 15](../rules/15-tests-must-be-seen-to-fail.md)). Confirmed with Stryker 10's Jest runner under `jest-expo` 58, scoped to plain TypeScript modules (React Native renders not tried). On any other stack, prove it runs and kills a deliberate mutant before relying on it.
- [ ] Test lint rules: `jest/expect-expect`, `jest/no-focused-tests`, `jest/valid-expect`, or the Vitest equivalents
- [ ] The test run fails if no tests ran

## Conventions

- [ ] For a project with its own server or API, the [convention templates](rules) copied into `.claude/rules/`: problem details, domain errors, structured logging and correlation IDs, each with its check

## Lint rules worth having

For React, React Native and TypeScript projects. Each catches something agents get wrong often.

- [ ] **`eslint-plugin-react-hooks` v7, recommended preset.** Beyond the rules of hooks, it includes the React Compiler rules. `set-state-in-effect` flags state derived inside an effect when it could be computed during render; `refs`, `purity` and `immutability` catch render-time side effects.
- [ ] **`react/no-unstable-nested-components`.** Flags components defined inside other components, which remount on every render.
- [ ] **`react/jsx-no-leaked-render`** (React Native especially). `{count && <View />}` renders a bare `0`, which crashes outside a `<Text>`.
- [ ] **`@typescript-eslint/no-explicit-any`.** If the type check is strict, `any` is a hole in it.
- [ ] **Type-aware `@typescript-eslint` rules.** `no-floating-promises` and `no-misused-promises` catch unawaited async calls, and `switch-exhaustiveness-check` catches unhandled union members. These need `parserOptions.project`, so they run slower; worth it on new projects.
- [ ] **`@tanstack/eslint-plugin-query`** if the project uses TanStack Query. Catches query keys missing dependencies and unstable query clients.
- [ ] **Accessibility.** `eslint-plugin-jsx-a11y` for the web. For React Native, check the rendered tree in tests instead (every control has a role and a name, targets are big enough); `eslint-plugin-react-native-a11y` doesn't support ESLint 9, and forcing it in with `--legacy-peer-deps` breaks other installs.
- [ ] **For Next.js,** `eslint-config-next` with the `core-web-vitals` preset.

## Data and security

- [ ] Migrations applied to an empty database on every change
- [ ] Privileges checked directly after migrations, not inferred from the migration files
- [ ] Dependency audit in CI, failing on high and critical advisories, with a dated allowlist for advisories nobody can fix yet ([template](audit)); Dependabot for updates, ignoring major versions ([CI template](ci.yml), [Dependabot template](dependabot.yml))
- [ ] Supply-chain hardening for npm ([template](npmrc)): install scripts off, a 7-day minimum release age, exact versions, installs only with `npm ci`, and a Dependabot cooldown to match. CI proves the settings take effect, because an npm older than 11.10 ignores the release age without a word. Bun and pnpm turn install scripts off by default and have their own release-age settings; the registry, and so the risk, is the same whichever client installs from it.
- [ ] The lockfile only points at the registry, over HTTPS, with integrity hashes (lockfile-lint), and installed packages pass `npm audit signatures` ([CI template](ci.yml))
- [ ] Every language in the project has its own audit, with the same dated-allowlist rule: `govulncheck ./...` for Go (it reports only vulnerable code the program actually calls, so it rarely needs an allowlist), `pip-audit` for Python, `cargo audit` for Rust, `bundle audit` for Ruby. The [audit template](audit) is npm's; the idea carries over
- [ ] The playbook's own plugins, and any other agent plugins or MCP servers, pinned to a commit and updated on purpose after reading the change (`node scripts/plugin-pins.mjs --updates` in the ai-playbook repository) ([rule 13](../rules/13-content-is-data-not-instructions.md))
- [ ] Secrets scanning over the full history: the gitleaks command-line tool, installed from its release with a pinned checksum, is free for any repository, unlike its GitHub Action on organisation repositories, and the same command runs locally. To prove it, plant a token gitleaks recognises (a `ghp_` token of the right length); its default allowlist ignores AWS's documented example key, so that proof passes silently. Also turn on GitHub secret scanning and push protection where the plan offers them.
- [ ] Shared agent permissions committed: deny secret files, ask before production ([template](settings.json))
- [ ] Agent credentials are least-privilege and non-production; every MCP server is vetted like a plugin ([rule 13](../rules/13-content-is-data-not-instructions.md))
- [ ] Agent configuration reviewed as code: [CODEOWNERS](CODEOWNERS) on `.claude/`, `.mcp.json`, `CLAUDE.md`, `AGENTS.md`, the workflows and the dev container, and the CI step that flags pull requests touching them ([rule 18](../rules/18-agent-configuration-is-code.md))
- [ ] Logging, error reporting and analytics scrub secrets and personal data, with a test that proves it ([rule 14](../rules/14-secrets-never-in-code-logs-or-telemetry.md))

## Workflows

- [ ] Actions pinned to commit SHAs, `permissions` set per workflow to the least each job needs, and `persist-credentials: false` on every checkout
- [ ] zizmor in CI, linting the workflows for script injection, risky triggers such as `pull_request_target`, over-broad permissions and credentials left on disk ([CI template](ci.yml)). An accepted exception is an inline `# zizmor: ignore[<audit>]` with the reason beside it. Run it with a token (`GH_TOKEN`), not `--offline`: the online audits are the ones that check each pinned SHA against its version comment, and the playbook's own CI found every `# v6` comment sitting on a v7 commit that way, after an offline run passed clean

## Containers

- [ ] The base image pinned by digest (`FROM image@sha256:…`), not a tag, and updated through Dependabot's `docker` ecosystem
- [ ] A minimal base (distroless or similar) and a non-root user; nothing in the image the app doesn't run
- [ ] The built image scanned in CI, for example with Trivy, failing on high and critical vulnerabilities with the same dated-allowlist rule
- [ ] The production image is the one the release rehearsal or the tests ran, not a rebuild

## Accessibility

- [ ] Automated checks (axe or similar) in every theme and mode the product supports: light, dark, high contrast, reduced motion, forced colours
- [ ] At more than one viewport width
- [ ] Keyboard checks: every control reachable and operable, visible focus
- [ ] Interactive states checked separately: hover and focus contrast, because automated checkers test the page at rest
- [ ] Text scaling: layouts reflow at large text sizes
- [ ] Worst-case data in every screen: long names, unbreakable emails, a count of one, empty lists, non-Latin and right-to-left text (the `break-ui` plugin). On React Native, where tests have no layout engine, feed the worst case through the fixture the accessibility gate renders, in both themes and at the largest text size, and record layout findings as device checks

## Performance

- [ ] Size budgets for JavaScript and CSS
- [ ] Interaction latency (INP) on a throttled device
- [ ] Largest contentful paint

## End to end and release

- [ ] The acceptance-test tier chosen and recorded in an ADR ([rule 16](../rules/16-acceptance-tests-are-isolated-and-real.md))
- [ ] End-to-end flows for the main journeys, on every platform shipped, before release (tier 2; Maestro for Expo and React Native)
- [ ] An environment check before any release or over-the-air update
- [ ] Device checks recorded in `docs/device-checks.md`, dated with the build, for what only a device can show (tier 3)

## Review

- [ ] Automatic review on every pull request, reading the project's own rules ([workflow](claude-review.yml))
- [ ] A fresh-context review of each slice before merge, by a reviewer given the diff and the rules, not the building session's reasoning
- [ ] A whole-codebase review against the rules at a fixed cadence (every few slices, and before each phase ends), briefed from `CLAUDE.md` and the design rather than a diff ([VERIFICATION.md](../VERIFICATION.md))
- [ ] An independent second opinion from a different model family for risky changes
- [ ] A security audit before releases
