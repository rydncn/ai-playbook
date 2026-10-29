# Done means the effect has been observed

**Area:** verification · **Enforced by:** plan format and review

## Rule

A task is done when its effect has been observed: the page renders differently, the request returns the new value, the test fails without the change and passes with it. Reading the changed code back does not count.

## Why

An agent can edit a file, read the edit back and report success while the actual behaviour is unchanged, because something else still wins. The only evidence that counts is evidence that could have shown the change failing.

## How to enforce it

Every task in a plan states how its effect will be observed before any code is written. The verification step runs that check before the task is marked complete, and review looks for it.
