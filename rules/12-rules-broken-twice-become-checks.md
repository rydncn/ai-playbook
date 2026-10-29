# A rule broken twice becomes a check

**Area:** process · **Enforced by:** the lesson skill flags repeats

## Rule

When a written rule is broken again, the fix is a test, a lint rule, a CI step or a hook. Restating the rule more firmly does not work.

## Why

An agent can have a rule in context and still break it. Instructions guide; checks enforce. Rules [1](01-enforce-security-boundaries-with-checks.md), [2](02-verify-database-privileges-directly.md) and [8](08-check-interactive-states.md) are examples of rules that are only reliable as checks.

## How to enforce it

When the lesson skill finds that a new lesson repeats an existing rule, it proposes a check instead of a second copy of the rule.
