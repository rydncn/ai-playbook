---
name: slices
description: Split a design's acceptance criteria into slice issues on GitHub, one per piece that can be reviewed and merged on its own, each with its blockers, done command, door and afk or hitl, checked with check-ticket.mjs. Use after the design is agreed and before building.
argument-hint: <path to the design, default docs/design.md>
disable-model-invocation: true
---

Split this design into slice issues: $ARGUMENTS (if empty, `docs/design.md`).

A slice is one pull request's worth of work that can be reviewed and merged on its own and leaves the product working. It's the unit an agent claims, the review gate judges and CI checks against its criteria. The issue is the slice's plan, in the shape of the `slice.yml` issue form from the playbook's `templates/tickets`.

## 1. Check the repository is set up

- `.github/ISSUE_TEMPLATE/slice.yml` and `scripts/check-ticket.mjs` exist, and the labels `slice`, `afk`, `hitl` and `ready` do (`gh label list`). If not, say what's missing and offer to add them from `templates/tickets` first, on a branch.
- The design has been read and agreed by the user. If it hasn't, stop and ask.

## 2. Draw the slices

Read the design and the code. Then propose the slices as a numbered list. For each one, give its name, the criteria it satisfies, what it's blocked by, its door and its mode. Wait for the user to agree before creating anything.

- **Thin and whole.** Each slice delivers criteria end to end, through every layer it needs, rather than one layer for every criterion. The first slice is usually the thinnest path that runs.
- **Every criterion lands in exactly one slice.** List any criterion that no slice covers, and any that two slices do.
- **Blockers only where real.** A slice is blocked by another only if it can't be built or tested without it. Unblocked slices can run in parallel.
- **The door.** One-way if it touches migrations or data deletion, auth and permissions, public API or URL shapes, what leaves the device, agent configuration, new dependencies, or release settings. Name the files. Prefer to put a one-way change in a slice of its own, so the rest stay two-way.
- **The mode.** `afk` only if the slice is small, its done command decides when it's finished, and it leaves no judgement call open. Anything with an open design question, a device check or a one-way door that needs thought is `hitl`. When unsure, `hitl`. The user confirms each one.

## 3. Write each issue

Fill every field of the form:

- **Satisfies:** the criteria quoted word for word from the design, each starting with its number (`AC3. …`). The criteria check in CI reads these numbers.
- **Design sections:** the headings the slice needs, so its session reads those and not the whole design.
- **Tasks:** `#### Task N: <behaviour>`, each with **Test:** (the failing test written first, its name carrying the criterion number in capitals, such as `TestAC3_…` or `it("AC3: …")`), **Code:** and **Observed by:**. A spike uses **Measure:**, **Record:** and **Decides:** instead.
- **Done when:** one command that runs the acceptance tests for these criteria and exits 0 only when they pass. Check that it runs and fails now, before the work: a command that passes already decides nothing.
- **Door** and **One-way files**, as drawn.
- **Blocked by:** `#n` for each blocker, or `None`. Create blockers first so their numbers exist, and add GitHub's own "Blocked by" relationship too.

Show the user each issue's body before creating it. Create it with `gh issue create --label slice --label <afk|hitl> --body-file <file>`, and keep the body in the form's `### Field` headings so the checks can read it.

## 4. Check each one

Run `GITHUB_TOKEN=$(gh auth token) GITHUB_REPOSITORY=<owner>/<repo> node scripts/check-ticket.mjs <number>` on every issue. Fix what it reports. A slice blocked by an open issue fails only on that line, which is expected.

Don't add `ready` yourself. Give the user the list of issues with each one's mode, door and blockers, and say that `ready` is theirs to add once they've read each one. A runner only takes issues labelled `ready` and `afk`.
