import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  appendLedger,
  mayStart,
  monthOf,
  readLedger,
  spentIn,
} from "./ledger.mjs";

test("months are UTC, as the Console bills", () => {
  assert.equal(monthOf("2026-11-30T23:30:00-05:00"), "2026-12");
});

test("a settled run counts at its cost, an unsettled one at its cap, and other months not at all", () => {
  const rows = [
    { runId: "a", month: "2026-11", status: "reserved", usd: 15 },
    { runId: "a", month: "2026-11", status: "settled", usd: 6.2 },
    { runId: "b", month: "2026-11", status: "reserved", usd: 15 },
    { runId: "c", month: "2026-10", status: "settled", usd: 40 },
  ];
  assert.equal(spentIn(rows, "2026-11"), 21.2);
});

test("the ledger survives a round trip, and a broken line is reported, not skipped", () => {
  const file = path.join(
    mkdtempSync(path.join(tmpdir(), "ledger-")),
    "l.jsonl",
  );
  assert.deepEqual(readLedger(file), []);
  appendLedger(file, { runId: "a", month: "2026-11", usd: 1 });
  assert.equal(readLedger(file).length, 1);
  writeFileSync(file, '{"runId":"a"}\n{oops\n');
  assert.throws(() => readLedger(file), /l\.jsonl:2: not JSON/);
});

test("a run may start only if its cap and some overshoot fit in what's left", () => {
  assert.equal(mayStart({ spent: 40, perRunUsd: 15, monthlyUsd: 60 }).ok, true);
  const no = mayStart({ spent: 45, perRunUsd: 15, monthlyUsd: 60 });
  assert.equal(no.ok, false);
  assert.match(
    no.reason,
    /leaving \$15\.00; a run capped at \$15\.00 needs \$16\.50/,
  );
});
