# A check has to prove it ran

**Area:** CI and gates · **Enforced by:** required status checks; gates that fail on an empty run

## Rule

CI is a required status check on the main branch, so a pipeline that stops running blocks merges. A gate that finds nothing to check fails rather than passing. When CI fails, read why before assuming it is the code.

## Why

CI can stop running without anyone noticing: billing lapses, a disabled workflow, a path filter that skips everything. Jobs refused before they start look like ordinary red crosses. A gate pointed at the wrong folder reports success on nothing. A job that skips itself can show green: an automatic review that declines to run on the pull request that adds its own workflow reports success without reviewing anything.

## How to enforce it

Turn on branch protection with the CI checks required. Make gates count what they checked and fail on zero. A check piped into another command (`go test ./... | tee test.log`) reports the last command's exit status, so a failing test exits 0: set `pipefail`. In GitHub Actions, `defaults: run: shell: bash` at the top of the workflow does it, because an explicit `bash` runs with `-eo pipefail` while the default shell runs with `-e` only. The project setup skill reads recent workflow runs and the reason for any failure. A green result proves nothing until the run has been seen to do its work: read the log of a check's first run, not just its colour.

Where the plan has no branch protection (GitHub Free on a private repository), nothing blocks a red merge mechanically. Write an ADR saying who merges and on what evidence (every CI job green on the pull request), keep the ask rules on pushing to `main` and on `gh pr merge` so agents can't merge on their own, and let CI on `main` catch whatever slips through. Never let CI cancel a run on `main`, or a broken merge can hide behind the next one.
