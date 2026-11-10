# Backlog

Changes agreed but waiting for evidence. Each says what it waits for.

## After the third trial

The third trial is designed to settle what the first two couldn't: the same app built twice from one brief, once under the playbook and once with plain Claude Code, then a blind review of both. It is a command-line tool in Python, with no UI, so it also tests the stack-neutral hooks and a pack written from `templates/stacks/README.md`.

- **What to cut from record-keeping**, on the controlled comparison's numbers. Both trials found it the main cost; the levels in "Start here" and the ADR threshold are the first cut.
- **A Python pack**, from the trial's real files, marked a draft until then.
- **Whether the four review questions close the gap.** The second trial's escapes were all of those classes; count what still gets past every automated layer when the brief asks them by name.

## Deferred

- **Evidence for rule 17.** The second trial ran most slices in one long session at the owner's choice, and its one fresh-session slice changed neither the count nor the kind of review findings. A later trial runs the same kind of slice both ways.
- **Adoption on an existing codebase.** Every trial so far started empty. Run the setup skill on a production codebase, adopt the level that fits, and record what it found, what it cost and what it got wrong.
- **Teams.** Code-owner review, shared permissions and the review cadence behave differently with several people; nothing here has been tried with more than one.
- **A check for private names.** The playbook is public and must not name the projects it was trialled on. A CI step reading the forbidden terms from a repository secret, printing only file names, once there's a clean repository to start it on.
- **Tested backup restores.** A restore is rehearsed on a schedule, and backups sit behind credentials separate from the ones that can delete production. Waits for a project with real data to back up.
