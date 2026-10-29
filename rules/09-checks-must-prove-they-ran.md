# A check has to prove it ran

**Area:** CI and gates · **Enforced by:** required status checks; gates that fail on an empty run

## Rule

CI is a required status check on the main branch, so a pipeline that stops running blocks merges. A gate that finds nothing to check fails rather than passing. When CI fails, read why before assuming it is the code.

## Why

CI can stop running without anyone noticing: billing lapses, a disabled workflow, a path filter that skips everything. Jobs refused before they start look like ordinary red crosses. A gate pointed at the wrong folder reports success on nothing.

## How to enforce it

Turn on branch protection with the CI checks required. Make gates count what they checked and fail on zero. The project setup skill reads recent workflow runs and the reason for any failure.
