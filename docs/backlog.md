# Backlog

Changes agreed but waiting for evidence. Each says what it waits for.

## After the second trial (a Go web app: server-rendered HTML and Postgres)

Built from the trial's real Go versions rather than designed in advance.

- **One set of hooks for every language.** The edit and stop hooks read the project's commands from a small config file (per file pattern: format, lint, test) instead of `package.json` scripts, Prettier and ESLint. The trial had to rewrite every npm-shaped hook for Go.
- **Templates split into a generic core and a pack per stack**, for example `stacks/node` and `stacks/go`, the Go pack taken from the trial. Say which rules apply to projects without a UI (libraries, command-line tools, data pipelines) and to CI outside GitHub Actions.
- **`api.md`: errors for browsers.** A request that prefers HTML gets the same problem fields as a page, not raw `application/problem+json`.
- **`api.md`: patterns the trial needed.** Sign-up that doesn't reveal whether an account exists (the same page; the difference is only in the mail); CSRF before sign-in; a maximum password length; a development mail outbox kept out of the structured log.
- **Turn the project's rules into acceptance criteria.** A person reviewing the trial's design found four gaps where a rule in `api.md` never became a criterion. The design step should walk the rules files and ask, for each, which criterion proves it.
- **Slimming, decided on numbers.** Compare the trial's effort per criterion and defects per review layer with trial 1's before cutting more. Keep verification (where the quality came from); cut record-keeping only where the trial managed without it. The handoff file stays: the trial needed one before slice 1.

## Deferred

- **Tested backup restores.** A restore is rehearsed on a schedule, and backups sit behind credentials separate from the ones that can delete production. Waits for a project with real data to back up.
