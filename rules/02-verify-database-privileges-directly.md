# Verify database privileges directly

**Area:** database permissions · **Enforced by:** CI job on an empty database

## Rule

After migrations run, check the privileges that actually result rather than trusting the migration files. In PostgreSQL, revoke execute from `PUBLIC` as well as from named roles before granting to the server role.

## Why

In PostgreSQL every role inherits from `PUBLIC`, which has execute on new functions by default. A migration that revokes from the client roles by name reads as locked down and changes nothing. Migration files describe intent; the catalogue describes what is true.

## How to enforce it

Apply every migration to an empty database in CI, then query the privileges and fail if any privileged function is executable by a client role:

```sql
SELECT COUNT(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE'))
     + COUNT(*) FILTER (WHERE has_function_privilege('authenticated', p.oid, 'EXECUTE'))
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef = true;
```

The role names here are Supabase's; substitute the project's own. A broken migration also fails to apply, which catches syntax mistakes for free.
