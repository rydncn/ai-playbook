---
name: design
description: Interview the user, one question at a time, to write a feature's design with numbered given/when/then acceptance criteria, before any plan or code. Use when starting a feature or project, or when the user asks for a PRD, spec or design.
argument-hint: <the feature or idea, in a sentence>
disable-model-invocation: true
---

Write the design for: $ARGUMENTS

The design says what to build and how it behaves, not how to build it. Everything after it depends on it: the slices quote its criteria, the tests name them, and CI checks that each one quoted has a passing test. A gap here passes every gate. So the user answers the questions, not you: a gap is cheapest to find here, before any code.

## 1. Read first, then ask

Read `CLAUDE.md`, the `.claude/rules/` files, any existing `docs/design.md` or `docs/designs/`, the ADRs in `docs/decisions/`, and the code the feature touches. Don't ask what the repository already answers. Say what you found in a few lines.

## 2. Interview, one question at a time

Ask one question per message, with the answer you'd recommend and why, so the user can reply "yes". Wait for the answer before the next. Go branch by branch until each is settled:

1. **Goal and scope.** Who it's for, what they get, and what is out of scope.
2. **Examples.** Ask for real inputs: a sample file, a request, a screen. Each one becomes a criterion read exactly as given, never edited to fit.
3. **Behaviour.** For each thing a user or caller does: the starting state, the action, what they can observe. Then the unhappy paths: empty, invalid, refused, offline, and the worst data it will really meet.
4. **Lifecycles.** Anything with stages: its states, each action, and the state it leads to or the refusal (rule 19). Every refused move becomes a criterion.
5. **The five questions** from `templates/REVIEW.md`, asked of the design, by name: what another parser does with each input; what two at once do; what a flood costs and what caps it; what one account or input can do to a result people rely on; what the caller learns when it only partly works. Each answer that matters becomes a criterion.
6. **The rules.** For each rule in `CLAUDE.md` and `.claude/rules/` with behaviour someone could observe, which criterion proves it? A rule with none is a gap; ask about it.
7. **Decisions.** Where there was a real alternative, note it for an ADR (`templates/ADR.md`). Write the ADR only where someone will ask why.
8. **Test tier.** Which tier of rule 16 the acceptance tests run at, and what's left for device checks.

Stop asking when every branch is settled, not when you run out of questions. If the user says "you decide", decide, and write down what you chose so they can check it.

## 3. Write it

Write `docs/design.md`, or `docs/designs/<feature>.md` for one feature of a larger project, from `templates/DESIGN.md` in the ai-playbook repo. Keep to its headings:

- Criteria are numbered `AC1`, `AC2` and so on, one `### ACn. <behaviour>` block each, with **Given**, **When**, **Then**. Each says what a user or caller would observe, never how the code does it. Numbers are never reused. A changed criterion keeps its number, and a dropped one stays as "withdrawn".
- Include the two criteria every design has: the examples read as given, and a README a new user can start from alone.
- Link ADRs; don't restate them.

Then show the user the criteria as a list and ask them to read them before anything else happens. Don't start slices or code from an unread design. Once they agree, commit it on a branch, and suggest `/playbook:slices` to split it into slice issues.
