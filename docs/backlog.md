# Backlog

Changes agreed but waiting for evidence. Each says what it waits for.

- **Adoption on an existing codebase.** First evidence: the templates alone, used for one feature on a production codebase. The fifth question found a real defect at once, and the design's three-direction check and an independent review were worth their cost; the gaps it found are fixed in the changelog entry after `d7082cc`. Still to do: the setup skill run on an existing codebase, and the hooks adopted there.
- **The Python and Go packs, proven twice.** Each has been through one project. Mark each proven once a second project has used it, with what that project changed.
- **The cost, and what each layer buys.** The [ablation trial](trials/ablation.md) measures tokens per criterion for each layer, and decides by rules agreed before it runs.
- **A small profile for the security audit.** The audit skill's full workflow (six phases, JSON ledgers with validators, an OS sandbox) fits a large target; on a small app even its quick profile is heavy, most of the effort going on the ledger format. The proposal for core projects: reconnaissance by the parent session, two or three hunters briefed with the attack classes, one verifier per candidate, a prose report and no ledger. Waits for the next core project to run it and compare what it finds and costs.
- **Teams.** Code-owner review, shared permissions and the review cadence behave differently with several people; nothing here has been tried with more than one.
- **A check for private names.** The playbook is public and must not name the private projects it is used on. A CI step reading the forbidden terms from a repository secret, printing only file names, once there's a clean repository to start it on.
- **Tested backup restores.** A restore is rehearsed on a schedule, and backups sit behind credentials separate from the ones that can delete production. Waits for a project with real data to back up.
- **Modern web guidance.** [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) is mentioned in the Node pack but not in the marketplace. Waits for a project with a web front end to build with and without it, and for a way to use it without running an unpinned npm package on every task.
