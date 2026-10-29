# Tests exercise behaviour

**Area:** testing · **Enforced by:** test-first workflow and review

## Rule

A test calls the code through its public interface and asserts on what a caller would observe: a return value, a response, a row written, an event sent. Three kinds of test are worse than none:

- **Tautological tests** assert what the test itself set up: a mock returns what it was told to, or the expected value is computed the same way the code computes it.
- **Change-detector tests** fail whenever the implementation changes, even when the behaviour hasn't: assertions on which private functions were called and in what order, snapshots of internals, or reading a source file and checking it contains a string.
- **Ticket-shaped regression tests**, such as a separate `test_bug_1234` next to a behaviour test that should have caught the bug.

A bug fix starts with a failing test that reproduces the bug, because that is how the fix is shown to work. Where that test belongs depends on the gap it exposed. If the behaviour was untested, the test is a new behaviour test, named for the behaviour. If an existing test should have caught it, that test is strengthened instead.

## Why

Agents write tests quickly, and the quickest tests to make pass are the ones that check the code against itself. Tautological tests pass while the feature is broken. Change-detector tests fail on every refactor, so people learn to update them without reading them, and then they protect nothing. A suite full of either looks healthy and makes changes slower. Tests named after tickets pile up beside the tests they duplicate, and nobody can tell which behaviour each one protects.

## How to enforce it

- Write tests first, and see each one fail for the right reason before the implementation exists ([rule 15](15-tests-must-be-seen-to-fail.md)).
- Mock only at boundaries the project doesn't own. Mocking the project's own modules is the usual route to both kinds of bad test.
- In review, ask of each new test what behaviour it protects and whether it would survive a refactor that kept that behaviour.
- Run mutation testing on changed code: a tautological test kills no mutants.
