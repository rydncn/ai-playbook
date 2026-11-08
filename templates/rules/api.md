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

## Errors are RFC 9457 problem details

Every error response, including the framework's own 404, 405 and validation failures, is `application/problem+json` with the same shape:

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
- Every form that changes something checks a CSRF token tied to the session, and rejects a cross-site `Origin` or `Sec-Fetch-Site`. `SameSite` alone is not the defence: it doesn't cover older browsers or same-site subdomains. A `GET` never changes state.
- Sign-in, sign-up, password reset and anything that sends an email are rate limited per account and per IP, and their failure messages don't say whether an account exists.
- Passwords are hashed with argon2id (or bcrypt where that isn't available) using the library's current recommended parameters, never a general-purpose hash.
- Output is escaped by the template engine's context-aware escaping. Anything that turns it off is a review comment.
- User-supplied redirect targets are checked against a list of the site's own paths.

## How these are checked

- An end-to-end or integration test asserts the security headers and cookie flags on a real response, and that a form post without its CSRF token, or from another origin, is refused.
- A contract test calls each endpoint's error paths and asserts the response is valid problem details with the documented `type`.
- A [rule check](../rule-check) fails on `throw new Error(` in domain folders.
