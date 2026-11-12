# <NNN>. <Slice name>

<!--
Copy to docs/plans/NNN-short-name.md. One file per slice: a piece of work
that can be reviewed and merged on its own, as one draft pull request. Tasks
are small enough to finish in one sitting, and each says how its effect will
be observed before any code is written (rules 5 and 15). Keep the
`### Task N:` headings: Superpowers' plan-running scripts look for them.
-->

**Status:** active · **Satisfies:** AC<n>, AC<n> (in `docs/design.md`) · **Depends on:** <slice numbers, or none>

<Quote the criteria this slice satisfies, word for word, and name the design sections it needs (by heading). A slice session reads this plan and those sections, not the whole design: a long design read in full by every session costs much of the context budget (rule 17).>

<!-- When the slice merges, set Status to "done, merged in #<PR>" in that pull request. A done plan records what was intended then, not what the code does now: agents never build from one, and docs/design.md stays the current description. -->

## Tasks

### Task 1: <the behaviour it adds>

- **Test:** <the failing test written first: file, name, and the assertion it fails on before the code exists>
- **Code:** <what changes, briefly>
- **Observed by:** <the test passing, a command and its output, a screenshot, or the device check>

### Task 2: <the behaviour it adds>

- **Test:** <…>
- **Code:** <…>
- **Observed by:** <…>
- **Observed on device by:** <only when nothing automated can see the effect: the entry in docs/device-checks.md>

<A spike, which measures something rather than building it, has no failing test to write first. Its tasks use **Measure** (what and how), **Record** (where the numbers go) and **Decides** (the design number or threshold the result sets) instead of Test, Code and Observed by. Spike code is thrown away, but it still gets the five questions in `templates/REVIEW.md`: a spike's loader that dropped a cut-short file's last line and exited 0 would have skewed every number taken from it.>

## Done when

- [ ] Every criterion above has an acceptance test that names it, seen failing before the code and passing after
- [ ] The quick checks and the tests pass in CI, with the pull request out of draft
- [ ] Device checks recorded for anything only a device can show, or marked as not yet done
