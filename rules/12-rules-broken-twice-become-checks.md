# A rule broken twice becomes a check

**Area:** process · **Enforced by:** the lesson skill flags repeats

## Rule

When a written rule is broken again, the fix is a test, a lint rule, a CI step or a hook. Restating the rule more firmly does not work.

A check states what it covers. "Checked by the wording test" has to say which text the test reads, and each of those places has been seen to fail with a planted fault. A check that covers less than it claims is worse than none, because people stop looking.

## Why

An agent can have a rule in context and still break it. Instructions guide; checks enforce. Rules [1](01-enforce-security-boundaries-with-checks.md), [2](02-verify-database-privileges-directly.md) and [8](08-check-interactive-states.md) are examples of rules that are only reliable as checks.

But a check earns trust by existing, and nobody asks what it covers. In the first trial of this playbook, a rule that the app must never say a device is "allowed, approved, accepted or permitted" was "checked by the wording test and a rule check". The rule check matched only some of the words, and the wording test read the domain code but not the screens, the translations or one of the two device types.

## How to enforce it

When the lesson skill finds that a new lesson repeats an existing rule, it proposes a check instead of a second copy of the rule.

Where `CLAUDE.md` says a rule is checked, it names the check and its scope: "checked by the wording test (domain text, screen text, every translation, both device types) and `no-acceptance-words` (every string literal under `src/`)". When the check is added, plant one fault in each place it claims to cover and watch it fail. Review the scope whenever a new surface appears, such as a new screen, language or output format.
