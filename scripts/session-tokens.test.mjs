import { test } from "node:test";
import assert from "node:assert/strict";
import { totals } from "./session-tokens.mjs";

const reply = (id, usage) =>
  JSON.stringify({ type: "assistant", message: { id, usage } });

test("each reply counts once, with its last usage, across files", () => {
  const a = [
    reply("m1", { input_tokens: 10, output_tokens: 1 }),
    reply("m1", {
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: 100,
    }),
    JSON.stringify({ type: "user", message: { content: "hi" } }),
    "not json",
  ].join("\n");
  const b = reply("m2", {
    input_tokens: 3,
    cache_creation_input_tokens: 50,
    output_tokens: 2,
  });
  assert.deepEqual(totals([a, b]), {
    replies: 2,
    input: 13,
    cacheWrite: 50,
    cacheRead: 100,
    output: 7,
  });
});
