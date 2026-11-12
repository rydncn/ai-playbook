"""Mutation testing on the source files a change touches (rule 15).

Usage: uv run python scripts/mutation_changed.py <base-ref>

Finds the files under the package in src/ that differ from <base-ref>, keeps
those in the core (MUTATION_CORE, a space-separated list of paths; the whole
package when unset), turns each into a mutmut name pattern
(src/pkg/money.py -> pkg.money.*), runs
mutmut on those mutants only, and fails when any mutant survived or when a
changed file produced nothing to run. No changed source file is reported and
passes: a change to docs or tests alone has nothing to mutate.

mutmut only counts tests that run the mutated code in-process, so tests that
drive the command line through a subprocess kill nothing; see
docs/python-pack/README.md.
"""

from __future__ import annotations

import re
import shutil
import os
import subprocess
import sys
from pathlib import Path

def package_dir() -> Path:
    """The one package under src/, as uv lays a project out."""
    packages = [p for p in Path("src").iterdir() if (p / "__init__.py").is_file()]
    if len(packages) != 1:
        sys.exit(f"expected one package under src/, found {len(packages)}")
    return packages[0]


SOURCE = package_dir()
CORE = [Path(p) for p in os.environ.get("MUTATION_CORE", "").split()]
RESULT_LINE = re.compile(r"^\s*(?P<name>\S+): (?P<status>.+)$")


def changed_source_files(base: str) -> list[Path]:
    diff = subprocess.run(
        [
            "git",
            "diff",
            "--name-only",
            "--diff-filter=AM",
            "--end-of-options",
            f"{base}...HEAD",
            "--",
            str(SOURCE),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    files = [Path(line) for line in diff.stdout.split() if line.endswith(".py")]
    if CORE:
        files = [f for f in files if any(f == c or c in f.parents for c in CORE)]
    return files


def pattern_for(path: Path) -> str:
    module = ".".join(path.relative_to("src").with_suffix("").parts)
    return f"{module}.*"


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: mutation_changed.py <base-ref>", file=sys.stderr)
        return 2
    files = changed_source_files(argv[1])
    if not files:
        print(f"No core file under {SOURCE} changed: nothing to mutate.")
        return 0
    patterns = [pattern_for(path) for path in files]
    # mutmut's stats (which test reaches which function) are incremental: a function
    # added since the last run is mapped only to tests added since, so start clean.
    shutil.rmtree("mutants", ignore_errors=True)
    print("Mutating:", " ".join(patterns))
    run = subprocess.run(["uv", "run", "mutmut", "run", *patterns], check=False)
    if run.returncode != 0:
        print(f"mutmut run exited {run.returncode}", file=sys.stderr)
        return 1
    results = subprocess.run(
        ["uv", "run", "mutmut", "results", "--all", "true"],
        capture_output=True,
        text=True,
        check=True,
    )
    statuses: dict[str, str] = {}
    for line in results.stdout.splitlines():
        match = RESULT_LINE.match(line)
        if match:
            statuses[match["name"]] = match["status"].strip()
    chosen = {
        name: status
        for name, status in statuses.items()
        if any(name.startswith(pattern[:-1]) for pattern in patterns)
    }
    if not chosen:
        print("No mutants matched the changed files; the gate checked nothing.", file=sys.stderr)
        return 1
    survivors = sorted(name for name, status in chosen.items() if status == "survived")
    bad = sorted(
        name
        for name, status in chosen.items()
        if status not in {"killed", "timeout", "survived", "suspicious"}
    )
    print(f"{len(chosen)} mutants: {len(survivors)} survived")
    for name in survivors:
        print(f"  survived: {name}")
    for name in bad:
        print(f"  {chosen[name]}: {name}")
    return 1 if survivors or bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
