# Agent compatibility

Agentic DevCraft skills follow the open
[Agent Skills specification](https://agentskills.io/specification): a
directory with a `SKILL.md` whose frontmatter uses only the spec's fields.
Any agent that implements the spec can load them. What differs per agent is
*where* skills are discovered, *how* they are triggered, and *which extra
frontmatter fields* are honoured.

Status meanings:

- `verified`: a maintainer installed the skills and observed the agent load
  one. The Evidence column says how and when.
- `documented`: the vendor documents support for the Agent Skills format and
  the paths listed, but this collection has not been tested there by a
  maintainer.
- `untested`: no claim is made.

| Agent | Status | Project path | Global path | Evidence |
|---|---|---|---|---|
| Claude Code | verified | `.claude/skills/` | `~/.claude/skills/` | 2026-10-20, Claude Code 2.1.304 on macOS: installed with `skills` CLI 1.7.4 from a local clone into `.claude/skills/`; `claude -p` listed the installed skills and loaded `scope-control` on explicit `/scope-control` invocation. |
| OpenAI Codex (CLI, IDE, ChatGPT desktop) | documented | `.agents/skills/` | `~/.agents/skills/` | |
| Cursor | documented | `.agents/skills/` or `.cursor/skills/` | `~/.agents/skills/` or `~/.cursor/skills/` | |
| Gemini CLI | documented | `.agents/skills/` or `.gemini/skills/` | `~/.agents/skills/` or `~/.gemini/skills/` | |
| GitHub Copilot (cloud agent, CLI, VS Code and JetBrains agent mode) | documented | `.github/skills/`, `.claude/skills/` or `.agents/skills/` | `~/.copilot/skills/` or `~/.agents/skills/` | |
| Other agents listed at agentskills.io | untested | per vendor | per vendor | |

Paths are taken from each vendor's documentation as of October 2026 and from
the `skills` CLI's agent table. Check the vendor docs if a path does not
work; they change.

## Known differences

- **Triggering.** Claude Code, Codex, Cursor and Copilot let the model load a
  skill automatically when the task matches its description. Gemini CLI asks
  the user to confirm activation. Codex and Cursor also support explicit
  invocation (`$skill-name` in Codex, `/skill-name` in Cursor and Claude
  Code).
- **Frontmatter.** This collection uses only `name`, `description`,
  `license` and `metadata`. Claude Code and Cursor accept additional fields
  (`paths`, `disable-model-invocation`, `allowed-tools` and others); these
  skills do not rely on any of them, so they stay portable. Hosts such as the
  Claude Skills API reject unknown keys, which is why the validator forbids
  them.
- **Context budget.** Codex caps the initial skill listing (descriptions) at
  roughly 2% of the context window and shortens descriptions when many
  skills are installed. Keeping descriptions dense and front-loaded matters
  there.
- **Cursor and GitHub sources.** Cursor's documentation states that skills
  from a GitHub repository must be packaged as a plugin and installed through
  a marketplace. Copying the skill directories into `.cursor/skills/` or
  `.agents/skills/` by hand, or using the `skills` CLI, is the alternative.
- **Nested project skills.** Claude Code and Cursor load skills from nested
  `.claude/skills/` or `.cursor/skills/` directories in subfolders. Other
  agents may not.

## What is not claimed

- No claim is made that every agent interprets MUST/SHOULD/CONSIDER with the
  same rigour. The levels are instructions to the model, not enforced
  policy.
- No benchmark numbers are published. The `examples/` scenarios are labelled
  `Illustrative` unless a maintainer records an actual transcript and marks
  it `Observed`.
- Agents not in the table above are not tested. Report results in an issue
  and the table will be updated.
