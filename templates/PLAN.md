# <NNN>. <Slice name>

<!--
Copy to docs/plans/NNN-short-name.md. One file per slice: a piece of work
that can be reviewed and merged on its own, as one draft pull request. Tasks
are small enough to finish in one sitting, and each says how its effect will
be observed before any code is written (rules 5 and 15).
-->

**Satisfies:** AC<n>, AC<n> (in `docs/design.md`) · **Depends on:** <slice numbers, or none>

## Tasks

### 1. <Task, as the behaviour it adds>

- **Test:** <the failing test written first: file, name, and the assertion it fails on before the code exists>
- **Code:** <what changes, briefly>
- **Observed by:** <the test passing, a command and its output, a screenshot, or the device check>

### 2. <Task>

- **Test:** <…>
- **Code:** <…>
- **Observed by:** <…>
- **Observed on device by:** <only when nothing automated can see the effect: the entry in docs/device-checks.md>

## Done when

- [ ] Every criterion above has an acceptance test that names it, seen failing before the code and passing after
- [ ] The quick checks and the tests pass in CI, with the pull request out of draft
- [ ] Device checks recorded for anything only a device can show, or marked as not yet done
