# Review gate

Makes review a gate rather than advice. The [Claude review workflow](../claude-review.yml) reviews every ready commit with the playbook's [brief](../REVIEW.md) and records a verdict: how many must-fix and should-fix findings, and whether the change is a one-way or a two-way door. [`gate.mjs`](gate.mjs), a required status check, turns the verdict into a pass or a fail:

| The change                                                    | Gate                                        |
| ------------------------------------------------------------- | ------------------------------------------- |
| Two-way door, nothing must be fixed                           | Passes                                      |
| A must-fix finding                                            | Fails until it is fixed, or a person rules  |
| A one-way door, by the reviewer or by the changed paths       | Fails until a person approves this commit   |
| No verdict for this commit (the review failed or was skipped) | Fails until it reruns, or a person approves |

A person approves with an approving review on the current commit, or the `human-approved` label, which every push removes. Either counts only from a login in the `HUMAN_APPROVERS` repository variable, and never from a bot. That puts the one human gate where a mistake can't be undone, and lets every two-way change merge on the automated layers alone, which is what an unattended run needs.

The door is decided twice. The reviewer reads it from the change, and the gate matches the changed files against [`one-way-paths`](one-way-paths) plus the `oneWayPaths` in the project's [`.claude/playbook.json`](../project), both read from the base branch so a pull request can't take itself off the list. A project file the gate can't read fails it. Either one saying one-way is enough.

## Using it

1. Copy `gate.mjs` to `scripts/review-gate.mjs` and `one-way-paths` to `.github/one-way-paths`. Put the project's own one-way paths in `oneWayPaths` in `.claude/playbook.json`, or in that file.
2. Use the playbook's [`claude-review.yml`](../claude-review.yml), which has the gate job, and follow its setup steps, including `HUMAN_APPROVERS` and the `human-approved` label.
3. Make **Review gate** a required status check on `main`. Without branch protection (GitHub Free on a private repository), the gate still shows red, but nothing stops a merge. For a personal account, GitHub Pro (about $4 a month) adds protected branches to private repositories and is the recommended setup; without it, write an ADR saying merges wait for the gate ([rule 9](../../rules/09-checks-must-prove-they-ran.md)).
4. See it work ([rule 9](../../rules/09-checks-must-prove-they-ran.md)): a pull request that touches `.github/one-way-paths` should fail the gate, then pass once you approve it. Next, plant a must-fix bug in a two-way file and watch the gate fail.

## After the merge

The gate decides before a merge; nothing in it sees what happened after. [`outcomes.mjs`](outcomes.mjs), run weekly by [`outcomes.yml`](outcomes.yml), counts the pull requests merged in the last 90 days by how the gate let them through (automated, approved by a person, or unreviewed), and how many of each were later reverted or blamed by a `regression` issue that says "Caused by #n". It fails when automated merges escape at more than 5%, with at least 20 to judge by: then two-way doors go back to needing a person (add `**` to `one-way-paths`) until the cause has a check. Vercel ran the same kind of switch, set at three times its baseline revert rate, before it let pull requests merge unreviewed.

1. Copy `outcomes.mjs` to `scripts/review-outcomes.mjs`, next to `scripts/review-gate.mjs`, and `outcomes.yml` to `.github/workflows/`. Create the `regression` label.
2. When a bug gets through, open its issue with the `regression` label and "Caused by #n". GitHub's Revert button already writes what the count reads.
3. See it trip ([rule 15](../../rules/15-tests-must-be-seen-to-fail.md)): run it by hand with `MIN_SAMPLE=1` and `MAX_ESCAPE_RATE=0` after one revert of an automated merge, and watch it fail.

## Limits

- A pull request can edit the workflow that runs its own checks. Workflows are on the one-way list, so a person has to approve such a change, and that person's reading of the diff is the boundary. An organisation can close this gap with a ruleset that requires the workflow from a protected branch.
- If agents push as you, an approval from you can't tell you apart from them. Give agents their own account or app, and leave it out of `HUMAN_APPROVERS`.
- The verdict is the model's judgement. A wrong must-fix finding costs a person's ruling, and a missed one gets through like any review's would. The gate makes the review count, but it doesn't make the review right.

The tests run with `node --test templates/review-gate/gate.test.mjs`.
