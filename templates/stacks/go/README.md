# Go pack

From the playbook's second trial: a Go web app (`net/http`, `html/template`, `pgx`) on Postgres, with Playwright end-to-end tests as the only npm.

| File                         | Copy to                                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`checks.json`](checks.json) | `.claude/checks.json`. The edit hook runs `gofmt -w` and `go vet` on the edited file's package; the stop hook runs `gofmt -l`, `go vet` and `go test`.                  |
| [`ci.yml`](ci.yml)           | `.github/workflows/ci.yml`. Format, vet, staticcheck and build; shuffled tests under the race detector; govulncheck, gitleaks, zizmor and the agent configuration step. |

Permissions to allow in `.claude/settings.json`, beside the template's deny and ask rules: `Bash(go build*)`, `Bash(go vet*)`, `Bash(go test*)`, `Bash(gofmt*)`, `Bash(staticcheck*)`, `Bash(govulncheck*)`, and the project's own database start-up script.

## What the trial learned

- **Test isolation** is `-shuffle=on`, `-count=1` (no cached results) and `t.Parallel()`, with the race detector on. A database per test, created from the migrated schema, kept parallel tests apart; `DROP DATABASE … WITH (FORCE)` needs the right to end the app role's connections, which only development and CI should grant.
- **Pipes hide failures** unless the shell has `pipefail`: `go test ./... | tee log` exits 0 on a failing test. The CI template sets `shell: bash` for this.
- **Prove the database permissions in the catalogue,** not from the migration: `ALTER DEFAULT PRIVILEGES IN SCHEMA … REVOKE … FROM PUBLIC` is silently a no-op, because a default granted globally can't be revoked per schema. The privilege test must create the kind of object it checks (a `SECURITY DEFINER` function) and fail when the app role can use it, or it passes on an empty schema (rule 2, rule 15). Qualify names from `information_schema` with `format('%I.%I', …)`, or `has_table_privilege` resolves against the wrong schema.
- **`Secure` cookies** only round-trip in tests through `httptest.NewTLSServer` and its client.
- **Redirect targets** need parsing: `http.Redirect` passes a tab through unchanged, and browsers strip it, so a `next` of `/<tab>/evil.example` leaves the site. See `rules/api.md`.
- **No-JavaScript pages and axe:** axe-core is JavaScript, so test the journeys with JavaScript off and run the accessibility scan with it on.
- **A strict CSP silences some planted breaks:** an inline style planted to break a layout check does nothing when the CSP forbids inline styles. Plant breaks the CSP allows.
- **The production image:** a Go build stage and distroless static as `nonroot`, both pinned by digest, `GOTOOLCHAIN=local` in the build so a `go.mod` bump can't download an unpinned toolchain, and a `.dockerignore` that lets in only what the build needs. The release rehearsal ran that image in production mode behind a TLS proxy with a throwaway certificate, against a fresh database with random passwords, then smoke-tested and scanned it.
- **govulncheck's database** can't be reached from a restricted network; it runs in CI.
