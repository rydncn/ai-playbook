# Acceptance tests are isolated and use real infrastructure

**Area:** testing · **Enforced by:** random-order and parallel test runs in CI; real services in the test environment

## Rule

Acceptance and integration tests run against real infrastructure: a real database with the project's migrations applied, real queues and storage, the real auth flow. Only services the project doesn't own, such as payment providers and third-party APIs, are replaced, and then with a fake that honours their contract rather than a mock per test.

Each test is independent. It creates the data it needs, doesn't depend on another test having run, and leaves nothing behind. The suite passes in any order and in parallel.

Unit tests stay fast and separate. These rules are for the tests that check the system works.

## Why

A mocked database accepts queries the real one rejects, ignores constraints and permissions, and returns whatever the test said it would. Tests against it pass while migrations, privileges and queries are broken, which are exactly the parts agents get wrong most often.

Tests that share state fail in ways that depend on the order they ran in. The failures look random, so people rerun them until they pass and stop trusting the suite. Leftover data also hides bugs: a test passes because a row created by an earlier test happens to be there.

## How to enforce it

- Start real services for the test run: containers (Testcontainers, or Docker Compose in CI) or the platform's local stack, with every migration applied from empty.
- Give each test its own data: unique IDs or tenants, a transaction rolled back after each test, or a truncate between tests. Never rely on seeded data another test may change.
- Run the suite in random order and in parallel in CI (for example Jest's `--randomize`, or Vitest's `sequence.shuffle`), so order dependence fails quickly rather than one day.
- Each acceptance test maps to an acceptance criterion written before the code ([VERIFICATION.md](../VERIFICATION.md)).
