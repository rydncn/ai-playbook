# Backlog

Changes agreed but waiting for evidence. Each says what it waits for.

## After the second trial (a Go web app: server-rendered HTML and Postgres)

Built from the trial's real Go versions rather than designed in advance. Fix the defects first; they are wrong today, not merely missing.

### Defects the trial found in the playbook

- **The CI template's npm check fails on the Node it selects.** `setup-node` with Node 22, the current LTS, ships npm 10.9; the "npm supply-chain settings take effect" step needs 11.10 for `min-release-age`, so the template fails as written. Pin a Node whose npm meets it, or install the npm version explicitly, and prove the job green.
- **The gitleaks proof plants a token gitleaks ignores.** "A `ghp_` token of the right length" isn't enough: an obviously fake one has too little entropy to match. Say to plant a random one.
- **A planted secret on any branch turns every pull request's scan red.** The security job checks out every branch (`fetch-depth: 0`) and gitleaks scans them all. Scan the pull request's own commits, or say to delete the proof branch at once.
- **Rule 9's "fail on nothing" misses pipes.** `go test ./... | tee log` in a `run:` step exits 0 on a failing test unless the shell has `pipefail`; GitHub's default `bash -e` doesn't. Say so wherever a template pipes a check.

- **Rule 15: commit before planting a break.** Undoing a planted break with `git checkout -- file` restores the committed version and erases uncommitted work in that file; the trial lost a slice's work this way. Plant breaks on a clean tree (commit or stash first), or undo them with an edit, never a checkout.

### Changes

- **One set of hooks for every language.** The edit and stop hooks read the project's commands from a small config file (per file pattern: format, lint, test) instead of `package.json` scripts, Prettier and ESLint. The trial had to rewrite every npm-shaped hook for Go.
- **Templates split into a generic core and a pack per stack**, for example `stacks/node` and `stacks/go`, the Go pack taken from the trial. Say which rules apply to projects without a UI (libraries, command-line tools, data pipelines) and to CI outside GitHub Actions.
- **`api.md`: errors for browsers.** A request that prefers HTML gets the same problem fields as a page, not raw `application/problem+json`.
- **`api.md`: patterns the trial needed.** Sign-up that doesn't reveal whether an account exists (the same page; the difference is only in the mail); CSRF before sign-in; a maximum password length; a development mail outbox kept out of the structured log.
- **`api.md`: three patterns both of the trial's reviews missed, each proven.** Redirect targets are checked by parsing (no scheme, no host, a path starting with one `/`) and by refusing every control character, not by a list of bad characters: a tab passed a check that refused `\`, CR and LF, and Chromium, which strips tabs from URLs, followed the redirect to another site. A rate limit counts the attempt atomically, before the slow work, not after it fails: checked first and recorded after the password hash, concurrent attempts all pass. Password hashing runs under a concurrency cap, since each argon2id hash holds its memory (19 MiB) for its whole run.
- **Security review briefs name the attack classes.** Two review layers read the same auth code and missed all three of those defects, because each was a question a reader of the code doesn't ask unprompted: what another parser does with the input (a browser stripping a tab), what two requests do at once (check, then slow work, then count), and what a flood costs (memory per hash). A fourth class came from the next slice: what one account can do to a result other people rely on. Ratings combined by median let one account outvote three honest ones within its rate limit, flipping an access attribute, while a code comment claimed the limit prevented exactly that; one vote per account per item is the fix. The review template and the fresh-context review brief ask these four by name for any change to authentication, sessions, redirects, uploads or other input handling, and the security audit is briefed the same way.
- **Turn the project's rules into acceptance criteria.** A person reviewing the trial's design found four gaps where a rule in `api.md` never became a criterion. The design step should walk the rules files and ask, for each, which criterion proves it.
- **Code-owner review on a one-person project.** Rule 18 and the CODEOWNERS template assume a second person. When the agent opens pull requests as the only owner, GitHub treats the requirement as met: the second trial's pull request changing a workflow had no review and was still mergeable. So code-owner review adds nothing there. Say so, and say what carries the rule instead: the CI flag, and the owner reading the flagged files before merging.
- **The Go pack's notes from the trial.** Isolation is `-shuffle=on`, `-count=1` and `t.Parallel()` rather than npm's randomise flags; `Secure` cookies round-trip only through `httptest.NewTLSServer`; axe needs JavaScript, so "works without JavaScript" is tested with it off and the accessibility scan run with it on; a strict CSP makes some planted breaks (an inline style) silent, so plant breaks the CSP allows; the settings allow and ask lists for Go.
- **Environment notes in a handoff go stale with the container.** A fresh session started without the tools the handoff said were installed, and spent twenty minutes finding out. The handoff template says to put tool installs in a setup script the next session runs, and to label anything else as true of one container only.
- **Rule 19 in practice.** The trial, set up before rule 19 existed, built moderation with an update that sets a status from any state: an approved spot can be rejected, a rejected one approved, and two moderators acting at once overwrite each other with no record of who decided. Tests, the fresh-context review and the design all treated each action alone. Check that rule 19's design section and transition test would have caught it, using this case.
- **Size the playbook to the project.** Three levels in "Start here", each a page of setup: a prototype (CI, the hooks, rule 5); a product (the core as defined now); personal data or money (the core, the security layer and the attack-class reviews). Everything else stays available but out of the way. The README leads with the levels rather than the full list, so a reader meets what they need first. The second trial's totals set where the lines fall.
- **Less record-keeping in the core.** Both trials found documentation, not verification, the main cost: the second wrote about 11,000 words of docs for about 6,800 lines of code and tests, including twelve ADRs for a small app. An ADR only where a real alternative was rejected and someone will ask why; no ADR for a default.
- **Keep the evidence at the front.** What sets the playbook apart from published prompt and skill collections is the checks that run on their own, checks seen to fail, and measured trials. Say so in the README, with the trials' numbers, honestly stated, including what got through.
- **Slimming, decided on numbers.** Compare the trial's effort per criterion and defects per review layer with trial 1's before cutting more. Keep verification (where the quality came from); cut record-keeping only where the trial managed without it. The handoff file stays: the trial needed one before slice 1.

## Deferred

- **Evidence for rule 17.** The second trial ran every slice in one session (to about 560k tokens) at the owner's choice, so it says nothing yet about whether a fresh session catches more. A later trial runs the same kind of slice both ways.

- **Tested backup restores.** A restore is rehearsed on a schedule, and backups sit behind credentials separate from the ones that can delete production. Waits for a project with real data to back up.
