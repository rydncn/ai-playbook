import { test } from "node:test";
import assert from "node:assert/strict";
import { unpinned } from "./plugin-pins.mjs";

const sha = "22f0b463e7a5e579904dd6211a520321035526f7";

test("relative-path plugins need no pin; pinned remote sources pass", () => {
  const marketplace = {
    plugins: [
      { name: "local", source: "./plugins/local" },
      { name: "a", source: { source: "github", repo: "o/a", sha } },
      {
        name: "b",
        source: { source: "git-subdir", url: "o/b", path: "x", sha },
      },
    ],
  };
  assert.deepEqual(unpinned(marketplace), []);
});

test("a remote source without a full lowercase SHA is reported", () => {
  const marketplace = {
    plugins: [
      { name: "none", source: { source: "github", repo: "o/a" } },
      {
        name: "ref-only",
        source: { source: "github", repo: "o/a", ref: "v1.0.0" },
      },
      {
        name: "short",
        source: { source: "github", repo: "o/a", sha: sha.slice(0, 12) },
      },
      {
        name: "upper",
        source: { source: "github", repo: "o/a", sha: sha.toUpperCase() },
      },
    ],
  };
  assert.deepEqual(unpinned(marketplace), [
    "none",
    "ref-only",
    "short",
    "upper",
  ]);
});
