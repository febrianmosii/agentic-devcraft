# Validation

`npm run validate` runs `scripts/validate-skills.mjs`, a zero-dependency Node
script (Node 20+). `npm test` runs the validator's own test suite with
`node:test` and additionally asserts that the repository itself validates with
zero errors.

```
npm run validate            # human-readable report, exit 1 on errors
npm run validate -- --strict   # warnings also fail
npm run validate -- --json     # machine-readable output
npm run validate -- --root ../some-other-skills-repo
```

## What is checked

### Skills (`skills/<name>/`)

| Check | Severity |
|---|---|
| Directory contains `SKILL.md` | error |
| Frontmatter starts on line 1 and is closed | error |
| Frontmatter parses in the supported YAML subset (no lists, one nesting level) | error |
| Only spec keys: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools` | error |
| `name`: 1-64 chars, `^[a-z0-9]+(-[a-z0-9]+)*$`, equals directory name | error |
| `name` unique across the collection | error |
| `description`: 1-1024 chars, non-empty | error |
| `description` mentions when to use the skill | warning |
| `compatibility`: 1-500 chars if present | error |
| `metadata`: mapping of string → string | error |
| Required section headings present (see [skill-authoring.md](skill-authoring.md)) | error |
| Body contains at least one `MUST` rule | error |
| `SKILL.md` ≤ 500 lines | error (warning above 350) |
| Relative links in `SKILL.md` and `references/*.md` resolve | error |
| Files in `references/`, `scripts/`, `assets/` are linked from `SKILL.md` | warning |
| No nested `SKILL.md` inside a skill directory | error |

### Examples (`examples/<skill>/*.md`)

| Check | Severity |
|---|---|
| Directory name matches a skill | error |
| Required headings: `Task`, `Without the skill`, `With the skill`, `Why it matters` | error |
| `**Status:** Illustrative` or `**Status:** Observed` | error |
| `Observed` scenarios include `**Observed with:**` | error |
| Relative links resolve | error |

### Documentation

| Check | Severity |
|---|---|
| Relative links in `README.md`, `CONTRIBUTING.md`, `docs/**/*.md` resolve | error |
| No banned over-claiming phrases in README, docs, skills, examples | error |
| `docs/compatibility.md` table has `Status` and `Evidence` columns | error |
| Each row's status is `verified`, `documented` or `untested` | error |
| `verified` rows have non-empty evidence | error |

The banned-phrase list is in `BANNED_CLAIMS` inside the script. It is a
literal, short list by design; it catches careless copy, not every possible
exaggeration.

## Cross-checking with the reference implementation

The Agent Skills project publishes a Python reference validator,
[`skills-ref`](https://github.com/agentskills/agentskills/tree/main/skills-ref).
It is labelled as a demonstration tool, so CI does not depend on it, but it is
a useful second opinion:

```
skills-ref validate skills/architecture
```
