#!/usr/bin/env node
// Every third-party plugin in the marketplace is pinned to a commit, so a
// change its authors push doesn't reach every machine until someone has read
// it and moved the pin.
//
//   node scripts/plugin-pins.mjs            fail if any remote source isn't pinned
//   node scripts/plugin-pins.mjs --updates  list plugins whose upstream has moved,
//                                           with a link to the changes to read

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHA = /^[0-9a-f]{40}$/;

/** Remote sources without a full, lowercase 40-character commit SHA. */
export function unpinned(marketplace) {
  return (marketplace.plugins ?? [])
    .filter((p) => typeof p.source === "object" && p.source !== null)
    .filter((p) => !SHA.test(p.source.sha ?? ""))
    .map((p) => p.name);
}

function repoOf(source) {
  const repo = source.repo ?? source.url;
  return repo.startsWith("http")
    ? repo.replace(/\.git$/, "")
    : `https://github.com/${repo}`;
}

function main(argv) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const marketplace = JSON.parse(
    readFileSync(path.join(root, ".claude-plugin", "marketplace.json"), "utf8"),
  );

  const missing = unpinned(marketplace);
  if (missing.length > 0) {
    console.error(
      `Not pinned to a commit: ${missing.join(", ")}. Add "sha" (40 lowercase hex characters) to each source.`,
    );
    return 1;
  }
  if (!argv.includes("--updates")) {
    console.log("Every third-party plugin is pinned to a commit.");
    return 0;
  }

  for (const plugin of marketplace.plugins.filter(
    (p) => typeof p.source === "object",
  )) {
    const repo = repoOf(plugin.source);
    const ref = plugin.source.ref ?? "HEAD";
    const head = execFileSync("git", ["ls-remote", repo, ref], {
      encoding: "utf8",
    }).split(/\s/)[0];
    if (head === plugin.source.sha) console.log(`${plugin.name}: up to date`);
    else
      console.log(
        `${plugin.name}: upstream has moved. Read ${repo}/compare/${plugin.source.sha}...${head} before pinning ${head}.`,
      );
  }
  return 0;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  process.exit(main(process.argv.slice(2)));
}
