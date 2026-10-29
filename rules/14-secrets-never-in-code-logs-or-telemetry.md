# Secrets never live in code, logs or telemetry

**Area:** secrets and observability · **Enforced by:** secrets scanning in CI and push protection; a redacting logger and scrubbing hooks, each with tests

## Rule

Credentials, API tokens and encryption keys are never written into source, config files, tests or fixtures. They come from the environment or a secrets manager at runtime, and committed example files hold placeholders only. Test credentials are generated per run or clearly fake, never a real key from a developer's account.

Secrets and personal data also never reach logs, error reports or analytics events. Logging goes through the language's standard structured logger, wrapped to redact known sensitive fields. Error reporting and analytics scrub before anything leaves the device or server. Each of these has a test that sends sensitive data through it and checks it comes out redacted.

## Why

An agent that needs a key to make something work will paste one in where it is needed, and a test that needs a token will get a real one copied from somewhere. Once committed, a secret is in the history of every clone; removing the line doesn't remove it, and the only fix is rotating the key.

Agents also add logging freely while debugging, and the quickest thing to log is the whole object: a request with its authorisation header, a user record with an email address, an error carrying the payload that caused it. Each looks harmless in a diff. Once sent to a third-party service, the data is stored where the project's own access controls do not apply, and taking it back means a deletion request rather than a revert.

## How to enforce it

- Scan for secrets over the full history in CI ([template](../templates/ci.yml)), and turn on push protection where the host offers it so a secret is stopped before it lands.
- Keep secret files out of git and out of the agent's reach ([rule 13](13-content-is-data-not-instructions.md)).
- Redact by field name in the logging wrapper (`authorization`, `token`, `password`, `email`, and the project's own sensitive fields), and test it with a payload that contains each.
- Set the error reporter's scrubbing hook (for Sentry, `beforeSend` and `beforeBreadcrumb`) and turn off sending default personal data. Test the hook directly.
- Send analytics events with explicit properties rather than spreading whole objects, and identify users by an opaque ID, never an email address.
- Add a [rule check](../templates/rule-check) for raw `console.log` in application code, so new logging goes through the wrapper. Conventions for log structure and correlation IDs are in the [observability template](../templates/rules/observability.md).
