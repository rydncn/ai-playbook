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
