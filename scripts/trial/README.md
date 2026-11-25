# The trial runner

Runs the [ablation trial](../../docs/trials/ablation.md)'s arms headless through the Claude Agent SDK, on API credit rather than a subscription, with each arm repeated so a result isn't one run's luck. Every run stops at its own dollar cap, and the runner won't start a run the month's budget can't cover.

## What it does

For each repetition of each arm:

1. Clones the arm's **starter repository**: an empty project for arm A, the playbook's files set up by hand for B, the same plus the agent definitions with pinned models for E. You prepare one starter per arm, once, so every repetition starts from exactly the same files.
2. Copies the brief into it as `docs/brief.md`, the same file for every arm.
3. Runs each of the config's `steps` as its own session in that workspace (one task per session, [rule 17](../../rules/17-one-task-per-session.md)), with the arm's plugins loaded from local folders and a fresh Claude config folder, so nothing from your own `~/.claude` (plugins, settings, memory) reaches any arm.
4. Writes `runs/<runId>/result.json`: whether it finished, its cost, turns and time, tokens and cost per model, the share of prompt tokens read from the cache, and warnings. The transcripts are in `runs/<runId>/home/.claude/projects/`, the built code in `runs/<runId>/work/`.

Arms run interleaved (A1, C1, A2, C2 …), so a stop part-way still leaves each arm with about as many runs.

## The spend cap

Three layers, each a backstop for the one before:

| Layer                     | What it stops                                                                                                                                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per run, `perRunUsd`      | The SDK's `maxBudgetUsd`. Each step gets what the earlier steps left. The SDK checks after each model call, so a run can end a little past its cap.                                                                                                                                                                  |
| Per month, `monthlyUsd`   | `runs/ledger.jsonl`. A run reserves its whole cap before it starts and settles at its real cost when it ends, and no run starts unless its cap plus 10% fits in what's left. A run that crashes keeps its reservation, so the total errs high; once the Console shows what it cost, `settle <runId> <usd>` fixes it. |
| The Console's spend limit | Everything else: another machine without the ledger, a bug here. Set it yourself (below). It's the only one Anthropic enforces.                                                                                                                                                                                      |

**Set up the Console side once:** create a workspace for the trials in the Claude Console, give it a monthly spend limit (about $70 for a $60 trial budget, so the ledger stops runs before the Console has to), and create the trial's API key inside that workspace. Its usage page is then the trials' bill, and nothing else draws on it.

## Prompt caching

Claude Code caches the prompt itself: the system prompt, tools and conversation so far are re-read from the cache on every call at a twentieth of the input price on Opus 5.5. The runner keeps that working by giving every repetition the same prompts and the same files, and nothing that changes per run (no run id or date) in what the model reads. The report shows each arm's cache share, and a run under 50% gets a warning, since a cold cache multiplies the bill.

## Cost per run

Measured so far, at list price on Opus 5.5 (`node scripts/session-tokens.mjs` over a cloud session's transcript): a working session costs about **$0.10 a reply** while its cache warms, falling towards $0.05 as cache reads take over. Assuming 100 to 150 replies an hour (a guess, not yet measured), that's roughly **$6 to $12 an hour of agent work**.

Against the trial's working times:

| Run                                                   | Working time | Estimated cost |
| ----------------------------------------------------- | ------------ | -------------- |
| Arm A on the full brief                               | about 2 h    | $12 to $25     |
| Arm B, C or E on the full brief                       | 5 to 8 h     | $30 to $100    |
| Arm D on the full brief                               | about 10 h   | $60 to $120    |
| The whole trial, once                                 | about 32 h   | $200 to $400   |
| One arm on a small brief (3 or 4 criteria, one slice) | about 1 h    | $6 to $12      |

So **$60 a month can't run the full trial with repeats**; one full run of every arm is several months' credit. What it can run is repeated small-brief runs: five or six a month, for example arms C and E three times each, which is what question 5 (does pinning subagent models cut the cost) needs, since its answer is mostly a cost per criterion. Questions about must-fix escapes need the full brief, and are better run once on the subscription, with this runner's repeats on the small brief to show how much one run varies.

These are estimates from one session's per-reply cost, not from a trial run. The first real run replaces them: start with one repetition of arm C on the small brief with `perRunUsd` at $10, then `report` shows what it cost.

## Running it

It needs Node 22, and a **container or VM** that holds nothing but the trial API key. Runs skip every permission prompt (nobody is there to answer them), so the agent can run any command the machine allows. That's what `--isolated` acknowledges. Claude Code also refuses to skip prompts as root, so run it as an ordinary user.

```bash
cd scripts/trial
npm ci                                   # the Agent SDK, from the lockfile
cp trial.example.json trial.json         # then edit: starters, plugin paths, steps
export ANTHROPIC_API_KEY=...             # the trial workspace's key; never commit it

node run-trial.mjs run --brief brief.md --arm C --arm E --reps 3 --dry-run   # the plan and whether it fits
node run-trial.mjs run --brief brief.md --arm C --arm E --reps 3 --isolated
node run-trial.mjs report                # per arm: mean, range, turns, cache share, cost per model
node run-trial.mjs spend                 # this month, spent or reserved
```

The agent can read `ANTHROPIC_API_KEY` from its own environment, as any process can ([rule 14](../../rules/14-secrets-never-in-code-logs-or-telemetry.md)). Keep the key in its own workspace with its spend limit, so a leaked key can only spend the trial budget, and rotate it after a batch of runs. On a cloud environment, a network secret keeps it out of the machine altogether ([agent-environment.md](../../docs/agent-environment.md#cloud-sessions)). Nothing else in your shell's environment reaches a run: it gets only `PATH`, `LANG`, `TERM` and the key.

**The config** (`trial.json`, ignored by git; start from [`trial.example.json`](trial.example.json)):

- `model` and `effort`: the same for every arm, as the trial requires.
- `budget`: `perRunUsd`, `monthlyUsd`, and `maxTurns` per step.
- `steps`: the prompts, in order, each a new session. They tell the agent nobody will answer questions, so every arm assumes the same way.
- `arms.<id>`: `starter` (a git URL or path) and `ref`; `plugins`, absolute paths to plugin folders (clone the marketplaces once and point at their plugin folders); and for arm E, `pinnedModels`, which must each show up in the run's tokens or the run doesn't count ([rule 7](../../rules/07-prove-config-takes-effect.md)).

## What it doesn't do yet

- **The pull-request parts of the trial.** The runner builds in a local clone; there's no CI, review gate or unattended `afk` slice. Arm C's unattended question still needs a real repository.
- **Grading.** Each run's `result.json`, transcripts and `work/` folder are what a grader reads. Batch-API grading (an LLM judge at half price over every run's code, against the rubric) is the next step; it reads `runs/*/result.json` to find them.
- **A schedule.** A nightly or weekly batch is a cron job or scheduled cloud task calling `run`, with the ledger on storage the runs share.

Tested: `node --test scripts/trial/`. The SDK wiring was checked once against the real API with an invalid key: the arm's plugin loaded, the run used the isolated config folder, and the error came back as a result the runner counts.
