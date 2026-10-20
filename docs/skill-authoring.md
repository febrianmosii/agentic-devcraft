# Writing a skill

This guide defines the structure every Agentic DevCraft skill follows. The
validator (`npm run validate`) enforces the structural parts; the rest is
editorial judgment that reviewers apply.

## Design goals

A skill is loaded into an agent's context only when it is relevant, and the
whole `SKILL.md` is loaded at once. Every line costs attention. Therefore:

- **Specific beats generic.** "Run the project's test command and paste the
  summary" is useful. "Write good tests" is not.
- **Rules carry their reasoning.** An agent that knows *what a rule prevents*
  can recognise the legitimate exception. One that only knows the rule cannot.
- **One skill, one concern.** Cross-cutting behaviour (workflow, honest
  reporting) is summarised in each skill's `Workflow` section and described
  fully in [agent-workflow.md](agent-workflow.md). Do not paste that document
  into skills.
- **Progressive disclosure.** `SKILL.md` stays under 500 lines (the validator
  warns at 350). Long checklists, language-specific detail and worked examples
  go in `references/` and are linked from the body.

## Directory layout

```
skills/<name>/
├── SKILL.md              # required
└── references/           # optional, each file linked from SKILL.md
    └── <topic>.md
```

Every file under `references/`, `scripts/` or `assets/` must be linked from
`SKILL.md`, otherwise the validator warns about an orphan.

## Frontmatter

Only the keys defined by the
[Agent Skills specification](https://agentskills.io/specification) are
allowed. Unknown keys fail validation because some hosts (for example the
Claude Skills API) reject them outright.

```yaml
---
name: scope-control            # must equal the directory name
description: >-                # 1-1024 chars; say WHAT and WHEN
  Keeps changes inside the requested task ... Use when fixing a bug, ...
license: MIT
metadata:
  collection: agentic-devcraft
  version: "0.1.0"
---
```

Frontmatter is parsed with a strict YAML subset: scalars, quoted scalars,
`|`/`>` block scalars, and one level of nested mapping for `metadata`. Lists
are rejected on purpose.

The `description` is the only text agents see before deciding to load the
skill. Lead with the capability, then the trigger ("Use when ..."), and include
the concrete words a user is likely to type.

## Required sections

The body must contain these headings, in this order. Level is free (`##` is
conventional).

| Heading | Content |
|---|---|
| `Purpose` | Two to four sentences: what the skill improves and what failure it prevents. |
| `When to use` | Concrete activation conditions and, where helpful, when *not* to use it. |
| `Rules` | Grouped under `MUST`, `SHOULD`, `CONSIDER` sub-headings. See rule format below. |
| `Workflow` | How Understand → Plan → Implement → Verify → Report applies to *this* concern. Only the skill-specific parts. |
| `Examples` | At least one short before/after pair, in prose or code. Longer scenarios live in `examples/<skill>/`. |
| `Anti-patterns` | Named failure modes an agent falls into, each with the correction. |
| `Verification checklist` | A short checkbox list the agent runs before reporting completion. |
| `Output` | What the agent's final report should contain for this skill, and what it must not claim. |

## Rule levels

| Level | Meaning | Deviation |
|---|---|---|
| **MUST** | Violating it causes a defect, a security hole, or a broken promise to the user. | Only with a documented exception in the report. |
| **SHOULD** | The right call in most contexts. | Allowed when the agent can state the reason in one sentence. |
| **CONSIDER** | Worth evaluating; often not worth doing. | No justification needed either way. |

Avoid rules that are really preferences (tabs vs spaces, a favourite library).
A rule earns its place by naming a concrete failure it prevents.

## Rule format

Each rule is a bold one-line statement followed by four short fields. Keep
every field to a single line where possible.

```markdown
- **Read the surrounding code before changing it.**
  Prevents: changes that contradict conventions already in the file.
  Applies: every edit to an existing file.
  Exception: a brand-new file in an empty directory.
  Verify: the diff uses the same naming, error-handling and import style as its neighbours.
```

The four fields answer: what it prevents, when it applies, when exceptions are
reasonable, and how compliance can be verified. A rule without a verifiable
check is a wish, not a rule.

## Examples and scenarios

Short examples go in the skill body. Full scenarios go in
`examples/<skill>/<scenario>.md` and follow this structure, which the validator
checks:

```markdown
# <Scenario title>

**Skill:** scope-control
**Status:** Illustrative

## Task
## Without the skill
## With the skill
## Why it matters
```

`Status` is `Illustrative` (written by a maintainer to show the intended
difference) or `Observed` (an actual transcript). Observed scenarios must add
an `**Observed with:**` line naming the agent, model and date. Never present an
illustrative scenario as an observation.

## Tone

Write for an expert reader with no time. Imperative mood. No motivational
preamble, no marketing language, no emoji. Prefer a concrete command or code
fragment over an adjective.
