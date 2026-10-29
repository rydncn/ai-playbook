# My setup

How the rules and verification in this repository are installed on my machines. This repository is a Claude Code plugin marketplace, so a change pushed here reaches every machine that has auto-update on, and each project's own knowledge stays in that project's `CLAUDE.md` and `.claude/rules/`.

## Plugins

| Plugin           | What it does                                                                                                                                   | From                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `superpowers`    | The core loop: brainstorm, plan, test-first execution, review, verification                                                                    | [obra/superpowers](https://github.com/obra/superpowers)                               |
| `pocock-extras`  | The parts Superpowers lacks: `grill-me`, `handoff`, `retro`, `wait-what` and `improve-codebase-architecture`, plus three skills they depend on | [mattpocock/skills](https://github.com/mattpocock/skills)                             |
| `codex`          | Independent reviews from a different model: `/codex:review`, `/codex:adversarial-review`                                                       | [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc)                   |
| `ponytail`       | Pushes towards the simplest code that works                                                                                                    | [dietrichgebert/ponytail](https://github.com/dietrichgebert/ponytail)                 |
| `security-audit` | A multi-phase security audit, used before releases                                                                                             | [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) |
| `playbook`       | Mine. `init-project` sets up or audits a project against the rules in this repository; `lesson` records a mistake as a rule in the right place | This repository                                                                       |

Third-party plugins are pulled from their own repositories rather than copied. Each must fill a gap rather than duplicate another. Together the plugins add about 2,600 tokens to each session, as reported by `claude plugin details`.

## Stack plugins

Skills for a particular framework are enabled per project rather than everywhere, so a project only pays the context cost for the stack it uses. I register them in the project's committed `.claude/settings.json`, which means every session on that repository gets them, including cloud sessions:

```json
{
  "extraKnownMarketplaces": {
    "expo-plugins": { "source": { "source": "github", "repo": "expo/skills" } },
    "supabase-agent-skills": {
      "source": { "source": "github", "repo": "supabase/agent-skills" }
    },
    "ai-playbook": {
      "source": { "source": "github", "repo": "rydncn/ai-playbook" }
    }
  },
  "enabledPlugins": {
    "expo@expo-plugins": true,
    "supabase@supabase-agent-skills": true,
    "postgres-best-practices@supabase-agent-skills": true,
    "react-best-practices@ai-playbook": true,
    "react-native-best-practices@ai-playbook": true
  }
}
```

| Plugin                                | What it covers                                                                                                                                                                  | From                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `expo`                                | Expo's official skills: EAS Update and Build, upgrades, Expo Router, native UI, app stores                                                                                      | [expo/skills](https://github.com/expo/skills)                                         |
| `supabase`, `postgres-best-practices` | Supabase's official skills, including the security traps (`SECURITY DEFINER` functions and `PUBLIC` grants, `user_metadata` in auth checks)                                     | [supabase/agent-skills](https://github.com/supabase/agent-skills)                     |
| `react-best-practices`                | Vercel's React rules, including deriving state without effects and moving effect logic into event handlers. Listed in this marketplace because Vercel does not publish a plugin | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)               |
| `react-native-best-practices`         | Callstack's React Native performance guide. Listed here with only this skill, rather than Callstack's five-skill bundle                                                         | [callstackincubator/agent-skills](https://github.com/callstackincubator/agent-skills) |

For Next.js, the framework now ships its own agent guidance: bundled docs and an `AGENTS.md` that `next dev` writes from 16.3, or `npx @next/codemod@canary agents-md` on earlier versions. The old `next-best-practices` skill is retired.

Skills guide; lint rules enforce. The [gate checklist](../templates/GATES.md) lists the ESLint rules that back these skills up.

## What each plugin runs on your machine

Plugins can run code in every session, and Anthropic does not review third-party marketplaces, so I read each plugin's hooks before adding it.

| Plugin         | Runs on your machine                                                                                                                         | Sends data anywhere                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| superpowers    | A bash hook at session start that loads its instructions                                                                                     | No                                                                             |
| pocock-extras  | Skills only                                                                                                                                  | No                                                                             |
| security-audit | Skills plus small Node validation scripts                                                                                                    | No                                                                             |
| codex          | Node hooks at session start and end to track background review jobs, and a stop hook that does nothing unless its review gate is switched on | Your code goes to OpenAI for review, under your own ChatGPT or OpenAI account  |
| ponytail       | Node hooks at session start, on each prompt and for subagents; reads `git ls-files` to map the repository                                    | Only if you set a webhook URL (empty by default); its task log is a local file |

Third-party entries follow their upstream. To freeze one at a reviewed version, add `"ref"` or `"sha"` to its `source` in [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json).

## Why Codex, and why it only advises

A reviewer from a different model family catches somewhat different mistakes. Greptile's study of 1,000 real AI-written pull requests found the gain to be real but small, about 2 to 3 points of serious bugs caught. A July 2026 preprint found that direction matters. Claude reviewing Codex's code helped a great deal, and Codex reviewing Claude's code made it worse when its suggestions were applied without checking. For that reason Codex reviews on a read-only profile and its findings are verified before anything changes.

## Install

Requires [Claude Code](https://code.claude.com). Once per machine:

```bash
git clone https://github.com/rydncn/ai-playbook ~/ai-playbook
~/ai-playbook/scripts/install.sh rydncn/ai-playbook
```

This links my personal defaults from [`user/CLAUDE.md`](../user/CLAUDE.md) into `~/.claude/`, adds the marketplace and installs every plugin. Then, in Claude Code:

1. `/plugin` → **Marketplaces** → **ai-playbook** → **Enable auto-update**.
2. `/codex:setup` to check Codex is signed in. It needs a ChatGPT plan or an OpenAI API key. Leave its review gate off; an automatic Claude and Codex loop uses up limits quickly.

To try only my own plugin: `/plugin install playbook --marketplace rydncn/ai-playbook`. If Superpowers is already installed from another marketplace, uninstall that copy first so it does not load twice.

## Sources

- Anthropic: [How Anthropic teams use Claude Code](https://claude.com/blog/how-anthropic-teams-use-claude-code); [Best practices for agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices); the Claude Code documentation on [plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces.md), [memory and rules files](https://code.claude.com/docs/en/memory.md) and [permissions](https://code.claude.com/docs/en/permissions.md); [claude-code-action](https://github.com/anthropics/claude-code-action).
- Review evidence: [Greptile, Model inversion](https://greptile.com/blog/model-inversion); [Cross-Model LLM Code Review (arXiv, July 2026)](https://arxiv.org/abs/2607.21656).
- Plugins: [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent; [Matt Pocock's skills](https://github.com/mattpocock/skills); [Ponytail](https://github.com/dietrichgebert/ponytail) by Dietrich Gebert and [JetBrains' independent test of it](https://blog.jetbrains.com/ai/2026/07/ponytail-skill-claude-tested/); [Cloudflare's security audit](https://github.com/cloudflare/security-audit-skill); [OpenAI's Codex plugin](https://github.com/openai/codex-plugin-cc).
