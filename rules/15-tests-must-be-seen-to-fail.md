# Tests must be seen to fail

**Area:** testing · **Enforced by:** test-first workflow; mutation testing on changed code

## Rule

A test only counts once it has been seen to fail when the behaviour it protects is broken. A new test fails before the implementation exists, for the reason it was written for: an assertion on the missing behaviour, not an import error or a typo. A test added to existing code is checked by breaking that code on purpose and watching the test fail. Mutation testing on changed code does this check mechanically.

## Why

A test that cannot fail is vacuous. Agents produce vacuous tests often: an assertion inside a callback that never runs, an `async` test that never awaits, a loop over an empty list, a `toThrow` on a function that is never called, or a test skipped by a stray `.only` elsewhere. Each one passes, raises the coverage figure, and catches nothing. Coverage counts lines that ran, not whether anything was checked.

## How to enforce it

- In the plan, each task records the failing test run before the implementation and the passing run after ([VERIFICATION.md](../VERIFICATION.md)).
- Turn on lint rules that catch the common forms: `jest/expect-expect`, `jest/no-focused-tests`, `jest/valid-expect` and `@typescript-eslint/no-floating-promises`, or the Vitest equivalents.
- Run mutation testing on the files a change touches, for example Stryker's `--incremental` mode for JavaScript and TypeScript. A surviving mutant is a behaviour no test protects. Running it on the whole codebase is usually too slow to be worth it; on changed files it is cheap.
- Fail the test run if no tests ran ([rule 9](09-checks-must-prove-they-ran.md)).
