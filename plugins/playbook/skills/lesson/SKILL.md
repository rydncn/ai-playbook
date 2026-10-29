---
name: lesson
description: Capture a lesson from a mistake or correction into the right CLAUDE.md so it doesn't happen again. Use whenever Claude got something wrong or the user corrected it.
argument-hint: <what went wrong, or leave empty to use the recent conversation>
---

What happened: $ARGUMENTS (if empty, use the most recent mistake or correction in this conversation).

1. Name the root cause in one sentence: what did Claude not know, or assume wrongly?
2. Write the lesson as a short, specific instruction that would have prevented it. Prefer "Do X" over "Don't Y", and include the concrete command, path, or name. Good: "Run `pnpm test:unit`, not `npm test`; the root test script needs Docker." Bad: "Be careful with tests."
3. Decide where it belongs:
   - **This project only** → the project's `CLAUDE.md`, under `## Lessons`. If it applies to one area of the code only, the matching `.claude/rules/<area>.md` file (create one with `paths:` frontmatter if none exists).
   - Always write it into the repo. Claude's auto memory stays on one machine, so a lesson kept only there never reaches other machines or cloud sessions.
   - **Every project** → it belongs in the ai-playbook repo, as a short line in `user/CLAUDE.md` or, if it needs explaining, as a new file in `rules/` using `templates/RULE.md` (the rule, why, and how to enforce it). Don't edit that repo from here; draft the rule and tell the user so they can add it. Keep it general: no client names, colleagues or internal system names.
   - **A workflow that keeps going wrong** (planning, review, debugging) → it may be a gap in a skill rather than a fact. Say so, and suggest the user note it in the ai-playbook repo.
4. Check the target file for an existing lesson that covers this; update it rather than adding a near-duplicate. If the same rule was already written down and still got broken, say so: it should become a check (a test, lint rule, CI step or hook), not more text.
5. Show the user the exact line and where it goes, then add it once they agree.
