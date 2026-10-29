# Acceptance tests are isolated and use real infrastructure

**Area:** testing · **Enforced by:** random-order and parallel test runs in CI; real services in the test environment

## Rule

Acceptance and integration tests run against real infrastructure: a real database with the project's migrations applied, real queues and storage, the real auth flow. Only services the project doesn't own, such as payment providers and third-party APIs, are replaced, and then with a fake that honours their contract rather than a mock per test.

Each test is independent. It creates the data it needs, doesn't depend on another test having run, and leaves nothing behind. The suite passes in any order and in parallel.

Unit tests stay fast and separate. These rules are for the tests that check the system works.

### Tiers

How real the infrastructure is comes in tiers. Each costs more to run than the one before and shows more:

1. **In-process.** The real app or service, driven through its public interface in the test runner, with everything the project owns real and only platform services faked at their boundary. For a server: a real database in a container. For an app with no server: the real storage layer and file handling, with fakes for the camera, notifications and other device services, each fake shared and honouring the platform's contract.
2. **Emulator or full stack.** The built app on an emulator or simulator (Maestro is the simplest for Expo and React Native), or every service running together.
3. **Real devices.** A written run-through on physical devices, for what nothing automated can observe: pickers, printing, notifications firing, screen readers, orientation.

Every project needs tier 1 in CI. A project that ships needs tier 2 for its main journeys before release, and tier 3 for anything only a device can show. Record the tier chosen and the reason in an ADR, so a reader who sees this rule and a design that stops at tier 1 knows it was a decision, not an oversight. Tier 3 observations go in `docs/device-checks.md`, dated with the build they were made on, and say plainly when a check has not been done.

## Why

A mocked database accepts queries the real one rejects, ignores constraints and permissions, and returns whatever the test said it would. Tests against it pass while migrations, privileges and queries are broken, which are exactly the parts agents get wrong most often.

Tests that share state fail in ways that depend on the order they ran in. The failures look random, so people rerun them until they pass and stop trusting the suite. Leftover data also hides bugs: a test passes because a row created by an earlier test happens to be there.

## How to enforce it

- Start real services for the test run: containers (Testcontainers, or Docker Compose in CI) or the platform's local stack, with every migration applied from empty.
- Give each test its own data: unique IDs or tenants, a transaction rolled back after each test, or a truncate between tests. Never rely on seeded data another test may change.
- Run the suite in random order and in parallel in CI (for example Jest's `--randomize`, or Vitest's `sequence.shuffle`), so order dependence fails quickly rather than one day.
- Each acceptance test maps to a numbered acceptance criterion in the design, written before the code ([VERIFICATION.md](../VERIFICATION.md)), and names it.
