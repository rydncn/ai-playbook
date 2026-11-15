# Slice runner

Runs one slice unattended, from a `ready` issue to a pull request that meets the same gates as anyone's. It's the execution step of the loop: the [design](../../plugins/playbook/skills/design/SKILL.md) and [slices](../../plugins/playbook/skills/slices/SKILL.md) skills write the issues, the [ticket check](../tickets) says when one is agent-ready, and the runner takes it from there. CI, the [criteria check](../criteria) and the [review gate](../review-gate) judge the result, and a person merges it.

## The boundary

The session can be talked into anything by what it reads, and with a shell it can run any code: through a git hook, a test, or a script it edits and then runs. So nothing that matters depends on the prompt. It depends on which job holds which credential:

| Job                                                              | Has a model | Its credentials                                                  | What it does                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------- | ----------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Choose the work** ([`claim.mjs`](claim.mjs))                   | No          | The job token, to label issues                                   | Takes the oldest open issue labelled `slice`, `ready` and `afk`, written by a person in `HUMAN_APPROVERS`, not `in-progress`, and passing `check-ticket.mjs` again now. Labels it `in-progress`. Or, given a pull request, takes a fix round on it, at most two. |
| **Build the slice**                                              | Yes         | A **read-only** job token, and the Claude API credential         | A fresh session on that issue: test-first, each test named for its criterion, the done command until it passes. Commits locally and hands over a git bundle and a summary. It can't push, open a pull request, label or merge.                                   |
| **Check and publish** ([`publish-check.mjs`](publish-check.mjs)) | No          | `SLICE_PUBLISH_TOKEN`: contents and pull requests, not workflows | Refuses the bundle if it touches the workflows, agent configuration, the check scripts or test runner configuration, or a one-way path on a two-way slice. Then pushes to `slice/<issue>` with an explicit refspec, and opens the pull request.                  |
| **Hand back**                                                    | No          | The job token, to label issues                                   | If nothing was published, the issue loses `afk` and `in-progress`, gains `hitl`, and gets a comment linking the run.                                                                                                                                             |

What this does and doesn't stop:

- **The session can't write to the repository.** Its token is read-only, and the Claude GitHub App's token isn't in its job. Whatever it runs, the only way out for its code is the bundle, and the publish check reads that as data, in a job the session never touched.
- **Only `slice/<issue>` is pushed.** The refspec is fixed by the workflow, not the session. A new slice won't overwrite an existing branch, and a fix round only adds to the commit it started from.
- **The publish token can't change workflows.** Without the Workflows permission, GitHub itself refuses a push that touches `.github/workflows/`, even if the publish check had a gap.
- **The session can read its own job's Claude credential,** and its network isn't limited, so assume that credential can leak. Use workload identity federation, so it's a token that lasts minutes, and a spend limit on the workspace. With the API key fallback, use a dedicated key and rotate it if a run looks wrong. The job's `id-token: write` also lets the session mint GitHub OIDC tokens, so don't let any cloud account trust this repository's tokens more broadly than this one federation rule.
- **Nothing here merges.** On GitHub Free with a private repository there's no branch protection, so a required check can't stop a merge: the person merging reads the gates first, and the review gate's README asks for an ADR saying so. The publish token can push to the default branch if misused, which is why it lives only in a job with no model and fixed commands.

## Using it

1. Set up the [tickets](../tickets), the [criteria check](../criteria) and the [review gate](../review-gate) first. The runner relies on all three to judge a slice.
2. Copy `claim.mjs` and `publish-check.mjs` to `scripts/`, next to `check-ticket.mjs`, and `runner.yml` to `.github/workflows/`. Create the labels `in-progress`, `fix-round-1` and `fix-round-2`.
3. Follow the setup steps at the top of `runner.yml`: `HUMAN_APPROVERS`, the Claude API authentication, `SLICE_PUBLISH_TOKEN`, the project's setup and services, and the commands the session may run.
4. Watch the first run in full ([unattended runs](../../docs/agent-environment.md#unattended-runs)). Check that it claimed the issue, opened a pull request from `slice/<issue>` that closes it, and that CI ran on that pull request.
5. See the boundary hold ([rule 15](../../rules/15-tests-must-be-seen-to-fail.md)): give it a slice whose done command can't pass, and check that the issue comes back as `hitl`. Then a slice whose task asks for a change to `.github/`, and check that the publish check refuses it.
6. For a fix round, run the workflow with the pull request's number once its checks or the review have finished.

## Limits

- Fix rounds start by hand (or from a schedule you add): nothing triggers one when a check fails, so a red slice pull request waits until someone runs one or takes it over.
- The session reads issue text and review comments that people wrote. Only issues an approver wrote are claimed, but comments and review findings come from whoever can post them. On a public repository, read the run's log before merging anything it built.
- `in-progress` stays on while a pull request is open. If a person closes that pull request without merging, they take the label off too.
- It has run in no trial yet. The [ablation trial](../../docs/trials/ablation.md) runs it on arm C's last three slices, and its result decides whether it stays.

The tests run with `node --test templates/runner/claim.test.mjs templates/runner/publish-check.test.mjs`.
