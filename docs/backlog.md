# Backlog

Changes agreed but waiting for evidence. Each says what it waits for.

- **Adoption on an existing codebase.** First evidence: the templates alone, used for one feature on a production codebase. The fifth question found a real defect at once, and the design's three-direction check and an independent review were worth their cost; the gaps it found are fixed in the changelog entry after `d7082cc`. Still to do: the setup skill run on an existing codebase, and the hooks adopted there.
- **The Python and Go packs, proven twice.** Each has been through one project. Mark each proven once a second project has used it, with what that project changed.
- **Whether the five review questions close the gap.** The second trial's escapes were all of the first four classes, and the third added the fifth. Count what still gets past every automated layer when the brief asks all five by name.
- **The cost.** The third trial's playbook build took about five times the plain build's working time; mutation testing and reviews were most of it. After aiming mutation testing at the core, measure again on the next project.
- **Evidence for rule 17.** The third trial ran every slice in a fresh session, but without a long-session arm to compare, and its warnings came late because the hook ran on messages only (now fixed). A later trial runs the same kind of slice both ways.
- **Teams.** Code-owner review, shared permissions and the review cadence behave differently with several people; nothing here has been tried with more than one.
- **A check for private names.** The playbook is public and must not name the projects it was trialled on. A CI step reading the forbidden terms from a repository secret, printing only file names, once there's a clean repository to start it on.
- **Tested backup restores.** A restore is rehearsed on a schedule, and backups sit behind credentials separate from the ones that can delete production. Waits for a project with real data to back up.
- **Modern web guidance.** [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) is mentioned in the Node pack but not in the marketplace. Waits for a project with a web front end to build with and without it, and for a way to use it without running an unpinned npm package on every task.
