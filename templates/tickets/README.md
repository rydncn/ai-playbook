# Tickets

A slice of work as a GitHub issue, so an agent can claim it, a person can see the queue, and a check can say whether it's ready. The issue is the slice's plan: the same shape as [`PLAN.md`](../PLAN.md), with three things a queue needs that a file in `docs/plans/` doesn't have: a mode, its blockers, and a state.

| File                                   | What it is                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`slice.yml`](slice.yml)               | An issue form for `.github/ISSUE_TEMPLATE/`: criteria, design sections, tasks, the done command, the door, blockers |
| [`check-ticket.mjs`](check-ticket.mjs) | Says whether an issue is agent-ready, and if not, what's missing. Tested                                            |

## Agent-ready

An issue is ready for an agent to start when `check-ticket.mjs` passes on it:

- it quotes the acceptance criteria it satisfies, word for word, with their numbers, and names the design sections it needs, so the session reads those and not the whole design ([rule 17](../../rules/17-one-task-per-session.md));
- every task names its failing test and how its effect is observed ([rule 5](../../rules/05-done-means-the-effect-was-observed.md)), or, for a spike, what it measures, where the numbers go and what they decide;
- one command decides when it's done. An unattended run uses it as its goal;
- its door is decided, and a one-way door names its files;
- it has exactly one of the labels `afk` (an agent may run it unattended) or `hitl` (it needs a person while it runs);
- every issue in "Blocked by" is closed.

A person adds the `ready` label once it passes. A runner claims only issues that are labelled `ready` and `afk` and pass the check again at claim time. Their blockers may have reopened.

## Labels

| Label   | Means                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `slice` | Made from the form                                                                                                             |
| `afk`   | An agent may run it without a person watching: small, with checks that decide when it's done, and no judgement call left in it |
| `hitl`  | It needs a person during the run: a design question still open, a device check, anything the done command can't see            |
| `ready` | It has passed the check and a person has read it                                                                               |

`afk` says nothing about the merge. A one-way door still waits at the [review gate](../review-gate) for a person's approval of the commit, however it was built.

## Using it

1. Copy `slice.yml` to `.github/ISSUE_TEMPLATE/slice.yml`, and `check-ticket.mjs` to `scripts/`. Create the four labels.
2. Write the design first ([`DESIGN.md`](../DESIGN.md)), then one issue per slice. Use GitHub's own "Blocked by" relationship too, where the plan has it. The check reads the form's field.
3. Before labelling an issue `ready`: `GITHUB_TOKEN=$(gh auth token) GITHUB_REPOSITORY=<owner>/<repo> node scripts/check-ticket.mjs <number>`.
4. The pull request for a slice says `Closes #<number>`, so merging it closes the issue and unblocks the next.

A project without a queue can keep plans in `docs/plans/` instead. The shape is the same, and only the mode and blockers are lost.

The tests run with `node --test templates/tickets/check-ticket.test.mjs`.
