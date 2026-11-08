# Where the agent runs

Permission prompts are one guardrail; where the agent runs is the other. The more the environment limits, the less each prompt has to, and the more the agent can be left to work.

## Three levels

| Level                    | What limits the agent                                                                                | Use it for                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Your machine, prompts on | The committed ask and deny rules ([rule 3](../rules/03-production-asks-first.md))                    | Day-to-day work with you watching                             |
| Your machine, sandboxed  | Claude Code's sandbox: commands can write only inside the project and reach only the domains allowed | Longer tasks with fewer interruptions                         |
| A dev container          | A container with a network firewall, holding only non-production credentials                         | Running without permission prompts, on repositories you trust |

## The sandbox

Claude Code's sandbox runs shell commands with operating-system limits on what they can write and which hosts they can reach. It works on macOS, Linux and WSL2 (Linux needs `bubblewrap` and `socat`); turn it on with `/sandbox` or in settings. A starting point for a project's `.claude/settings.json`:

```json
{
  "sandbox": {
    "enabled": true,
    "allowUnsandboxedCommands": false,
    "network": {
      "allowedDomains": ["registry.npmjs.org", "github.com"]
    }
  }
}
```

- `allowUnsandboxedCommands: false` stops a command that fails in the sandbox from being retried outside it.
- Add the domains the project really needs: the package registry, the git host, the local database. Not the production API.
- `autoAllowBashIfSandboxed` skips prompts for sandboxed commands. Only turn it on once the network list is tight, and keep the ask rules for anything that reaches production: those still apply.
- `excludedCommands` runs named commands outside the sandbox. It is for tools that can't run inside it, such as Docker, not a way to loosen it.
- List the documentation hosts the project's `CLAUDE.md` tells the agent to read, or that instruction can't be followed. For Expo: `docs.expo.dev`, plus `api.expo.dev` and `reactnative.directory`, which `npx expo install` needs to pick versions. Without those two, read the version from `node_modules/expo/bundledNativeModules.json` and use `npm install <package>@<version>`.

## Cloud sessions

A cloud session (Claude Code on the web, or a scheduled task) runs in a fresh container, and **installs nothing from the project's plugin settings**. The plugins in `enabledPlugins` are only offered on a prompt in an interactive session, and in the cloud nobody answers it. Installing them during the session doesn't help either, because skills load when a session starts. Without a fix, every cloud session quietly does the playbook's steps by hand, and nobody notices until someone asks which plugins it used.

The fix is the environment's **setup script**, which runs when the container is built, before Claude Code starts. Set it in the environment's settings, on the session-start screen's environment selector. Install the same plugins the project enables:

```bash
#!/bin/bash
set -euo pipefail

claude plugin marketplace add rydncn/ai-playbook
for p in playbook superpowers pocock-extras ponytail security-audit break-ui; do
  claude plugin install "$p@ai-playbook"
done
# Plus each stack plugin the project enables, for example:
# claude plugin marketplace add expo/skills && claude plugin install expo@expo-plugins

claude plugin list
```

- **Start it with `set -e`.** Without it, a failed install lets the session start without the plugin, and the setup reports success.
- **A private marketplace can't be added from GitHub here.** The setup script runs before the session's GitHub credentials are connected. Add it from the environment's clone of the repository instead, if the repository is attached to the environment (`claude plugin marketplace add <path to the clone>`), or make the marketplace public.
- **Check the build's output once** after changing the script. It should list every plugin.
- **The plugin check hook** ([`templates/hooks/check-plugins.mjs`](../templates/hooks/check-plugins.mjs)) warns at the start of any session where an enabled plugin is missing. The account-level plugin list a cloud session can read doesn't show plugins installed in the container, so `claude plugin list` is the check.
- The setup script's result is cached for a few days, so later sessions start quickly.

## Unattended runs

An agent can work while nobody watches: a scheduled task, an overnight run through a queue of tickets, a cloud session left running. Mistakes then compound for hours before anyone sees them, so:

1. **Run one iteration with you watching first.** Give it one ticket, read the whole transcript, and fix the prompt, the plan or the checks where it went wrong. Only then let it run unattended, and read the first unattended run in full too.
2. **Only work marked for it.** The queue holds tickets whose plan says they can run unattended: small, with checks that decide when they're done. Anything that needs a judgement waits for a person.
3. **Somewhere that limits the damage.** A dev container or a cloud session, never your own machine with prompts switched off; non-production credentials only ([rule 13](../rules/13-content-is-data-not-instructions.md)); its own worktree and database.
4. **The output is a draft pull request.** An unattended run never merges, releases or reaches production; the ask rules stay on, so it stops at them ([rule 3](../rules/03-production-asks-first.md)).
5. **A limit on time and spend,** set where the run starts (a timeout on the job, a spend limit on the key), and a written summary at the end of each run of what it did, what it skipped and why.

## Repositories you didn't write

A repository's committed `.claude/settings.json` can run hooks as soon as Claude Code trusts the folder, and its `.mcp.json` can start servers. Before accepting the trust prompt for a repository someone else wrote, read `.claude/settings.json`, anything in `.claude/hooks/`, `.mcp.json` and the `CLAUDE.md` files, as you would an install script ([rule 18](../rules/18-agent-configuration-is-code.md)). To look around one you haven't read, open it in a dev container or a cloud session that holds no credentials you care about.

## Dev containers

Anthropic publishes a reference dev container (`.devcontainer/` in the `anthropics/claude-code` repository) with a firewall that allows only the hosts Claude Code and package installs need. Inside it, `--dangerously-skip-permissions` is reasonable for unattended work, with two conditions:

- **Only on repositories you trust.** A malicious repository can still read anything inside the container, including the agent's own credentials, and send it to an allowed host.
- **Only with non-production credentials** ([rule 13](../rules/13-content-is-data-not-instructions.md)). The container limits where the agent can reach; it doesn't make a production key safe to hold.

To stop anyone on a team using the flag outside a container, set `permissions.disableBypassPermissionsMode` to `"disable"` in managed settings.

## Parallel sessions

Several sessions can work at once without colliding, each in its own git worktree: `claude --worktree <name>` creates one under `.claude/worktrees/` on its own branch. Gitignored files a session needs, such as a local env file, are copied in by listing them in `.worktreeinclude`.

- Give each session one task with its own written plan and checks. Parallel sessions multiply the cost of vague work as well as the throughput.
- Each branch goes through the same gates and review as any other ([VERIFICATION.md](../VERIFICATION.md)). The hooks in [`templates/hooks`](../templates/hooks) run in every worktree, since they live in the committed settings.
- Tests that share a database across worktrees break the isolation in [rule 16](../rules/16-acceptance-tests-are-isolated-and-real.md). Give each worktree its own database or schema.
