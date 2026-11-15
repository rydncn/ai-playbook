# Criteria coverage

A required check that every acceptance criterion a slice says it satisfies has a test that names it, and that the test ran and passed in this run. The [ticket check](../tickets) makes a slice quote its criteria before an agent starts; this one checks, after the work, that each of them is covered by a test that passed. Without it, an agent can meet the slice's done command with tests that never touch a criterion, and nothing notices.

[`check-criteria.mjs`](check-criteria.mjs) reads three things:

| From                                    | It takes                                                                |
| --------------------------------------- | ----------------------------------------------------------------------- |
| The pull request body                   | The issues it closes (`Closes #12`)                                     |
| Each closed issue's **Satisfies** field | The criteria quoted there, by number (`AC3`)                            |
| The test report from this run           | Every test's name and outcome, from JUnit XML or `go test -json` output |

It fails, naming the criterion, when no test's name carries the number, when every test that does was skipped or failed, or when the report is missing or has no tests ([rule 9](../../rules/09-checks-must-prove-they-ran.md)). A pull request that closes no slice issue passes with a note, since dependency updates and docs aren't slices. The job summary shows a table of criteria, the tests naming each, and how many passed.

## Naming tests

A test names its criterion with the number in capitals, anywhere in its name or its suite's name. [Rule 16](../../rules/16-acceptance-tests-are-isolated-and-real.md) already asks for this.

| Runner | Example                                     |
| ------ | ------------------------------------------- |
| Vitest | `it("AC3: a refund is stored as money in")` |
| Go     | `func TestAC3_RefundIsIncome(t *testing.T)` |
| pytest | `def test_AC3_refund_is_income():`          |

`AC3` doesn't match `AC30`, and `ac3` in lower case doesn't count.

## Using it

1. Copy `check-criteria.mjs` to `scripts/check-criteria.mjs`. The [review gate's](../review-gate) `one-way-paths` template lists it, so a pull request that changes the check needs a person's approval; keep that line in the project's copy.
2. Have the test run write a report. Vitest: `vitest run --reporter=default --reporter=junit --outputFile.junit=reports/junit.xml`. Jest: `jest-junit`. pytest: `--junitxml=reports/junit.xml`. Go: `go test -json`.
3. Add the "Criteria covered" step after the tests. It's already in [`ci.yml`](../ci.yml) and the [Go](../stacks/go/ci.yml) and [Python](../stacks/python/ci.yml) packs. The tests job needs `pull-requests: read` and `issues: read`.
4. See it fail ([rule 15](../../rules/15-tests-must-be-seen-to-fail.md)): on a slice's pull request, rename the test for one of its criteria so the number is gone, and watch the check name that criterion.

## Limits

- It checks that a test naming the criterion passed, not that the test checks the criterion. A test called `AC3` that asserts nothing passes. That's for the review and mutation testing to catch.
- The criteria come from the issue as it is when the check runs. Someone who edits the Satisfies field can narrow what is checked. The issue's history shows the edit.

The tests run with `node --test templates/criteria/check-criteria.test.mjs`.
