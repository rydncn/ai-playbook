---
# Set these to where the project's server code and logging setup live.
paths:
  - "src/server/**"
  - "src/lib/logger*"
  - "supabase/functions/**"
---

# Logging and correlation

## Structured logging

- Use the language's standard structured logger, or the established one where there is no standard: `log/slog` in Go, `logging` with a JSON formatter or `structlog` in Python, `ILogger` in .NET, SLF4J with a JSON encoder in Java, pino in Node. This project uses <logger>, through `<path to wrapper>`.
- Log JSON lines. The message is a fixed string; the values that vary go in fields, so logs can be searched and counted: `logger.info({ orderId, total }, "order placed")`, not a message built from a template string.
- Every line carries `level`, `time`, `service` and `correlationId`.
- Levels mean something: `error` needs someone to act, `warn` is unexpected but handled, `info` is a business event, `debug` is off in production.
- Never log whole request bodies, user records or headers. Redaction rules are in rule 14 of the playbook.

## Correlation IDs

- Accept an incoming W3C `traceparent` header, or the project's request ID header, and generate an ID when there isn't one. Return it in a response header and in error responses.
- Pass it on with every outgoing HTTP call and in the metadata of every queued message, and restore it in the consumer.
- Carry it across async boundaries with the runtime's context mechanism, never by threading a parameter by hand: `AsyncLocalStorage` in Node, `contextvars` in Python, `context.Context` in Go, `Activity` in .NET, MDC in Java (copied onto pool threads, which don't inherit it). OpenTelemetry does all of this if the project uses it.

## How these are checked

- A test makes one request that awaits, starts background work and publishes a message, then asserts that every log line it produced, including the consumer's, carries the same correlation ID. Losing the ID across an async boundary is the usual failure, and nothing else catches it.
- A [rule check](../rule-check) fails on raw `console.log` (or the language's equivalent) in application code.
