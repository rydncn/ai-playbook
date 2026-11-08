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
- [ ] Secrets scanning over the full history: the gitleaks command-line tool, installed from its release with a pinned checksum, is free for any repository, unlike its GitHub Action on organisation repositories, and the same command runs locally. To prove it, plant a token gitleaks recognises (a `ghp_` token of the right length); its default allowlist ignores AWS's documented example key, so that proof passes silently. Also turn on GitHub secret scanning and push protection where the plan offers them.
- [ ] Shared agent permissions committed: deny secret files, ask before production ([template](settings.json))
- [ ] Agent credentials are least-privilege and non-production; every MCP server is vetted like a plugin ([rule 13](../rules/13-content-is-data-not-instructions.md))
- [ ] Logging, error reporting and analytics scrub secrets and personal data, with a test that proves it ([rule 14](../rules/14-secrets-never-in-code-logs-or-telemetry.md))

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
