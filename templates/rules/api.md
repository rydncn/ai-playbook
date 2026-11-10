---
# Set these to where the project's server code lives.
paths:
  - "src/server/**"
  - "src/api/**"
  - "supabase/functions/**"
---

# API conventions

## Secure by default

- Every endpoint requires authentication unless it is explicitly marked public, and public endpoints are listed here: <list>.
- Check authorisation for the specific resource, not only that the caller is signed in. Every endpoint that reads or changes a user's data has a test where a different signed-in user is refused.
- Validate every request body, query and path parameter with a schema at the boundary, before any other code sees it. Reject unknown fields.
- Writes that a client may retry accept an idempotency key.
- Anything combined from many people's input (ratings, votes, counts, a median) counts each account once per item: its latest contribution. Otherwise one account outvotes everyone else within its rate limit.
- Every list is bounded: a maximum page size, and a maximum page number or keyset pagination, so no request costs a full scan.

## Errors are RFC 9457 problem details

Every error response, including the framework's own 404, 405 and validation failures, is a problem with the same fields. An API client gets `application/problem+json`:

```json
{
  "type": "https://example.com/problems/insufficient-credit",
  "title": "Insufficient credit",
  "status": 409,
  "detail": "The order total is 40.00 but the available credit is 25.00.",
  "instance": "/orders/8f2c",
  "correlationId": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

- A browser (a request whose `Accept` prefers `text/html`) gets the same fields rendered as an HTML page with the same status code, not raw JSON.
- `type` is a stable URI per kind of problem, documented, and what clients branch on. `title` is fixed for the type; `detail` explains this occurrence.
- Validation failures add an `errors` member listing each field and what is wrong with it.
- Responses never contain stack traces, SQL, internal IDs of other users, or the text of an unexpected exception. Unexpected errors return a generic 500 problem with the correlation ID, and the detail goes to the log.

## Domain code throws specific errors

- Domain code throws errors named for what went wrong in the domain (`OrderNotFound`, `InsufficientCredit`, `PermissionDenied`), never `new Error("something failed")` or a bare string.
- Domain errors know nothing about HTTP. One mapping at the edge turns each into its problem type and status code, so the same error means the same response everywhere.
- Catch an error only to add context, recover, or map it at the edge. Don't catch and log and rethrow in every layer.

## Pages served to a browser

For a server that renders pages or sets cookies. Leave this section out for an API only apps call.

- Every response carries the security headers from one middleware: a `Content-Security-Policy` with no `unsafe-inline` or `unsafe-eval` (start from `default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`), `Strict-Transport-Security` in production, `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`.
- Session cookies are `Secure`, `HttpOnly` and `SameSite=Lax` (or `Strict`), with the `__Host-` prefix and no `Domain`. The session ID is random, at least 128 bits, stored hashed, changed at sign-in and at any change of privilege, and ended on the server at sign-out.
- Every form that changes something checks a CSRF token and rejects a cross-site `Origin` or `Sec-Fetch-Site`. The token works before sign-in too (sign-in and sign-up forms included), so it is tied to a separate random cookie, not only to a session that doesn't exist yet; otherwise another site can sign a visitor into the attacker's account. `SameSite` alone is not the defence: it doesn't cover older browsers or same-site subdomains. A `GET` never changes state.
- Nothing says whether an account exists. Sign-in failures share one message. Sign-up shows the same page whether or not the address is taken; the difference is only in the mail sent to that address. An unknown address at sign-in still costs a password hash, against a dummy, so the timing doesn't tell either.
- Sign-in, sign-up, password change, password reset, account deletion and anything that sends an email are rate limited per account and per IP. Every route that checks a password shares one per-account limit, or each route adds its own allowance of guesses. The attempt is counted atomically before the slow work (the password hash), not recorded after it fails: checked first and counted later, a burst of concurrent attempts all pass. A per-account limit also lets anyone lock a known account out; say in an ADR how the project weighs that.
- Passwords are hashed with argon2id (or bcrypt where that isn't available) using the library's current recommended parameters, never a general-purpose hash. A password longer than a fixed maximum (for example 1,024 bytes) is refused before hashing, and hashing runs under a concurrency cap (for example one slot per CPU), because each argon2id hash holds its memory for its whole run and a flood of sign-ins can exhaust the server.
- Output is escaped by the template engine's context-aware escaping. Anything that turns it off is a review comment.
- A user-supplied redirect target (a `next` after sign-in) is checked by parsing it: it parses, has no scheme and no host, its path starts with exactly one `/`, and it contains no control character (below 0x20, or 0x7f) and no `\`. A list of bad characters isn't enough: browsers strip tabs and newlines from URLs, so `/<tab>/evil.example` passes a check for `//` and lands on another site.
- In development, mail goes to an outbox the developer can read, never into the structured log, which must hold no addresses.

## How these are checked

- An end-to-end or integration test asserts the security headers and cookie flags on a real response, and that a form post without its CSRF token, or from another origin, is refused, before sign-in as well as after.
- A browser test follows a redirect after sign-in with a tab, `//`, `/\` and an absolute URL in `next`, and asserts each lands on the site.
- A test sends 20 concurrent wrong-password attempts and asserts no more than the limit reach the password check; another spreads guesses across every route that checks the password and asserts they share one limit.
- A test has one account contribute many times to an item others have contributed to, and asserts the combined result is unchanged.
- A contract test calls each endpoint's error paths and asserts the response is valid problem details with the documented `type`.
- A [rule check](../rule-check) fails on `throw new Error(` in domain folders.
