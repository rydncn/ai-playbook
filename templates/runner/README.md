# Slice runner

Runs one slice unattended, from a `ready` issue to a pull request that meets the same gates as anyone's. It's the execution step of the loop: the [design](../../plugins/playbook/skills/design/SKILL.md) and [slices](../../plugins/playbook/skills/slices/SKILL.md) skills write the issues, the [ticket check](../tickets) says when one is agent-ready, and the runner takes it from there. CI, the [criteria check](../criteria) and the [review gate](../review-gate) decide whether the result merges. The runner never does.

| Step   | Job                        | What it does                                                                                                                                                                                                                                    |
| ------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claim  | [`claim.mjs`](claim.mjs)   | Takes the oldest open issue labelled `slice`, `ready` and `afk` that isn't `in-progress` and passes `check-ticket.mjs` again now, since its blockers may have reopened. Labels it `in-progress`.                                                |
| Build  | [`runner.yml`](runner.yml) | A fresh Claude Code session on that issue only: the issue, `CLAUDE.md`, the rules and the design sections it names. Test-first, each test named for its criterion, the done command until it passes, then a pull request that closes the issue. |
| Fix    | The same session           | Waits for the required checks. On a failure it reads the log and the review's findings as data and fixes what's real, at most two rounds.                                                                                                       |
| Finish | `runner.yml`               | If no open pull request closes the issue with its required checks passing, the issue loses `afk` and `in-progress`, gains `hitl`, and gets a comment linking the run.                                                                           |

One slice per run and one run at a time. A one-way door still waits at the review gate for a person to approve the commit, however the slice was built.

## Using it

1. Set up the [tickets](../tickets), the [criteria check](../criteria) and the [review gate](../review-gate) first. The runner relies on all three to stop a bad slice; without them it's an agent pushing unchecked code.
2. Copy `claim.mjs` to `scripts/`, next to `check-ticket.mjs`, and `runner.yml` to `.github/workflows/`. Create the `in-progress` label.
3. Follow the setup steps at the top of `runner.yml`: the Claude API authentication, the project's setup and services, and the commands the session may run.
4. Watch the first run in full ([unattended runs](../../docs/agent-environment.md#unattended-runs)). Check that it claimed the issue, opened a pull request that closes it, and that CI ran on that pull request. Pushes and pull requests made with the workflow's default token start no workflows; the Claude GitHub App's token does, and this is where you'd find out it didn't.
5. See the hand-back work ([rule 15](../../rules/15-tests-must-be-seen-to-fail.md)): give it a slice whose done command can't pass, and check that the issue comes back as `hitl` with a comment.

## Limits

- The session's tool list and the "Never" list in the prompt are what keep it off the checks and the agent configuration. The [one-way paths](../review-gate/one-way-paths) are the backstop: a pull request that touches them waits for a person at the gate whatever the session did.
- The session reads issue text and review comments that people wrote. It's told they are data ([rule 13](../../rules/13-content-is-data-not-instructions.md)), but that isn't a boundary. What limits the damage is its credentials: no production keys in the job, and a token that can push branches and open pull requests but not merge.
- `in-progress` stays on while a pull request is open. If a person closes that pull request without merging, they take the label off too.
- It has run in no trial yet. The [ablation trial](../../docs/trials/ablation.md) runs it on arm C's last three slices, and its result decides whether it stays.

The tests run with `node --test templates/runner/claim.test.mjs`.
