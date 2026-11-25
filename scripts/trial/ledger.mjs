// The spend ledger: one JSON line per event, so a month's spend survives a
// crash, a killed process and a second machine sharing the file.
//
// Before a run starts, it reserves its whole per-run cap; when it ends, the
// reservation is settled at what the run really cost. A run that never settles
// (killed, crashed) keeps its reservation, so the month's total errs high,
// never low. Settle it by hand with `run-trial.mjs settle <runId> <usd>` once
// the Console shows what it cost.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** "2026-11" for a date, in UTC, as the Console bills. */
export function monthOf(date) {
  return new Date(date).toISOString().slice(0, 7);
}

/** The ledger's rows; a line that doesn't parse is reported, not skipped. */
export function readLedger(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch {
        throw new Error(`${file}:${i + 1}: not JSON; fix the line by hand`);
      }
    });
}

export function appendLedger(file, row) {
  mkdirSync(path.dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(row) + "\n");
}

/**
 * Dollars a month has spent or holds reserved: each run's latest row counts,
 * so a settled run counts at its cost and an unsettled one at its cap.
 */
export function spentIn(rows, month) {
  const latest = new Map();
  for (const r of rows) if (r.month === month) latest.set(r.runId, r);
  let sum = 0;
  for (const r of latest.values()) sum += r.usd;
  return sum;
}

/**
 * Whether a run capped at perRunUsd may start. The SDK checks its budget after
 * each model call, so a run can end a little past its cap; `overshoot` is the
 * share of the cap kept free for that.
 */
export function mayStart({ spent, perRunUsd, monthlyUsd, overshoot = 0.1 }) {
  const need = perRunUsd * (1 + overshoot);
  const left = monthlyUsd - spent;
  if (need <= left) return { ok: true, left };
  return {
    ok: false,
    left,
    reason: `$${spent.toFixed(2)} of this month's $${monthlyUsd.toFixed(2)} is spent or reserved, leaving $${left.toFixed(2)}; a run capped at $${perRunUsd.toFixed(2)} needs $${need.toFixed(2)}`,
  };
}
