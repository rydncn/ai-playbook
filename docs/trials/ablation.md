# The ablation trial

**Status:** designed, not run · **Waits for:** the consolidation PRs merged, and a brief

This trial takes the playbook apart, so each layer keeps its place only by showing an effect worth its cost. It also tries the parts a software factory would stand on: the review gate, agent-ready tickets and an unattended run.

## Questions, in order of what they decide

1. **Do the plugins earn their place?** The playbook's own files (the hooks, CI, settings, the review gate, the design, ticket and brief templates) against the same plus the default plugins.
2. **Does aiming the expensive layers by door lose findings?** Mutation testing, a second review and the audit on every slice, against the [door table](../../VERIFICATION.md#5-independent-review).
3. **Does dropping the in-session review lose findings,** once the CI review and its gate run? This is answered inside arm C against arm D, because D also keeps the builder's own reviewer.
4. **Can a slice run unattended?** One arm's last slices are taken from the queue as `afk` issues, with nobody watching.
5. **Does naming each subagent's model cut the cost without losing findings?** A subagent inherits the session's model unless its definition names one, so exploring, copying and summarising run on the most expensive model in the session. Arm E names a model for every subagent: the session's model for anything that needs judgment, and Haiku only for mechanical work.

## Arms

All arms get one brief, the same session model and the same environment, under these rules:

- The brief describes the product, not acceptance criteria, and every arm gets the same environment, model and language version. The control's environment has no plugins, because skills such as test-driven development switch themselves on; its setup script fails if any are present.
- Nobody reviews any build's code until all are done. The owner merges when asked without reading, and answers every arm's questions alike, so the trial measures the playbook and not the owner.
- Every arm keeps the same effort log, in the same columns.
- The blind reviewer gets anonymised copies in a random order, and a rubric with objective tests written before it reads any code. Nothing it can see names an arm, including comments in its environment's setup script. Check the anonymiser's own effects too: a redaction can lengthen a line past the linter's limit or replace a URL with a placeholder.

| Arm           | What it gets                                                                                    | Answers                      |
| ------------- | ----------------------------------------------------------------------------------------------- | ---------------------------- |
| A, control    | Plain Claude Code, no plugins, no playbook files                                                | The baseline, on a new brief |
| B, core       | The playbook's files, set up by hand from [new-project.md](../new-project.md); no plugins       | 1                            |
| C, default    | B plus the default plugins, with the layers aimed by door                                       | 1, 2, 3, 4                   |
| D, everything | C, with every expensive layer on every slice and the builder's own fresh-context review as well | 2, 3                         |
| E, pinned     | C, with a model named for every subagent                                                        | 5                            |

Arm C runs its last three slices unattended (question 4): `ready`, `afk` issues that passed `check-ticket.mjs`, each issue's done command as the `/goal`, in a cloud session, and ending in a pull request that the review gate decides. The first of the three is watched in full, as the [unattended runs](../agent-environment.md#unattended-runs) section asks.

In arm E, every subagent definition (`.claude/agents/*.md`) has `model:` in its frontmatter, and every dispatch the session makes names a model. Review, design, debugging and anything with a verdict stay on the session's model. Haiku gets only mechanical work: copying code a plan already holds, running a command and reporting its output, and drafting a summary that a stronger model then checks. Before the arm counts, its transcripts must show each pinned subagent answering on its pinned model ([rule 7](../../rules/07-prove-config-takes-effect.md)); `session-tokens.mjs` lists the tokens per model for this.

## The brief

A web API with accounts, so the two earlier gaps get tested: an existing kind of escape (one account against a shared result, two requests at once) and a server the playbook's API rules cover. It should be about 15 acceptance criteria's worth of work, with at least two one-way doors (a migration, an auth change), and sample inputs handed over as given. Write it, and the rubric, before any arm starts.

## Measures

The same for every arm, written in the same effort log:

| Measure          | How                                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quality          | The blind review's rubric score, with objective tests written before the reviewer reads any code                                                                        |
| Must-fix escapes | The blind review's must-fix findings, each tagged with the review question or lifecycle it belongs to                                                                   |
| Test strength    | Planted regressions caught, from one list planted in every arm afterwards                                                                                               |
| Robustness       | The same hostile inputs and probes against every build                                                                                                                  |
| Usability        | Whether a new user can start from the README alone, scored by the rubric                                                                                                |
| Tokens           | [`scripts/session-tokens.mjs`](../../scripts/session-tokens.mjs) over every transcript the arm produced, subagents included, plus the CI review's cost from the Console |
| Cost             | Each model's tokens from the same script, priced at that model's list price on the day, because a Haiku token costs a fraction of an Opus one                           |
| Time             | Working time, and a person's minutes, kept apart                                                                                                                        |
| Per criterion    | Tokens, cost and working time divided by acceptance criteria delivered                                                                                                  |
| Unattended       | For arm C's unattended slices: whether each finished, what the gate decided, and every place a person had to step in                                                    |

## Decisions, agreed before the results

A layer stays in the default only if the arm with it does better on must-fix escapes or quality, by at least one must-fix or two rubric points, at less than 25% more tokens per criterion. Otherwise it becomes optional, as `codex` and `ponytail` did.

- **B against C:** if C doesn't clear the bar, the plugins go optional and the core stands alone.
- **C against D:** if D clears the bar against C, the layer it adds for two-way doors goes back in. If it doesn't, the door table stands, and the per-slice in-session review stays out.
- **Unattended:** if any unattended slice needed a person beyond the gate's one-way approval, the factory waits until that cause has a check.
- **C against E:** if E costs at least 20% less per criterion than C, with no more must-fix escapes and no more than one rubric point lower, naming each subagent's model becomes part of the default, with E's split between judgment and mechanical work. Otherwise subagents keep inheriting the session's model. If any pinned subagent answered on another model, E doesn't count until the pin is fixed and the arm is run again.
- **Every arm against A:** if C or B no longer beats the control on must-fix escapes, the playbook stops claiming to beat plain Claude Code until a trial shows it again.

One run per arm is still one run. Write the result up with that said, and treat it as evidence, not proof, until a second run agrees.

## Cost

Roughly, A takes about 2 hours, B, C and E about 5 to 8 each, and D about 10. That's about 32 hours of working time and a few hours of a person's, mostly for the brief, the rubric, the unattended slices and reading the results.

On API credit, [`scripts/trial`](../../scripts/trial/README.md) runs the arms headless through the Agent SDK, each repeated, under a per-run and a monthly spend cap. At Opus 5.5's list price the whole trial is an estimated $200 to $400 for one run of each arm, so a $60 monthly budget fits repeats only on a small brief: enough for question 5, which is mostly about cost, and to show how much one run varies. The runner's [cost section](../../scripts/trial/README.md#cost-per-run) has the working, and the first real run replaces the estimate.
