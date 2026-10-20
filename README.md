# Agentic DevCraft

**Engineering craftsmanship for AI coding agents.**

An open-source collection of software engineering skills and guardrails, in
the open [Agent Skills](https://agentskills.io) format, that helps AI coding
agents build maintainable, secure, reliable and production-ready software.

## The problem

Coding agents are capable and fast, and they fail in predictable ways. They
widen a one-line fix into a refactor. They add a factory for two
implementations. They report "all tests pass" without running anything. They
rename a database column in place and take the running app down with it.
They write `catch {}` and move on.

None of these are knowledge gaps. The models know better. They are judgment
gaps that appear when nothing in the context says *stop here*, *measure
first*, or *say what you did not verify*.

## What Agentic DevCraft does

Each skill is a short, structured document an agent loads when the task
calls for it. A skill gives the agent:

- **Rules with reasons.** Every rule says what it prevents, when it applies,
  when an exception is reasonable, and how compliance is verified. Rules are
  graded `MUST`, `SHOULD`, `CONSIDER` so the agent can tell a hard
  requirement from a judgment call.
- **A concern-specific workflow.** What *Understand → Plan → Implement →
  Verify → Report* means for security, or for a migration, rather than a
  generic checklist.
- **Named anti-patterns** the agent is likely to fall into, each with the
  correction.
- **An output contract.** What the final report must contain and what it
  must never claim.

Skills are plain Markdown. There is no runtime, no server, no custom CLI.

## Skills

| Skill | What it guards | Release |
|---|---|---|
| [`scope-control`](skills/scope-control/SKILL.md) | Keeps the diff equal to the task: no drive-by refactors, no silent extras, explicit out-of-scope reporting. | v0.1.0 |
| [`architecture`](skills/architecture/SKILL.md) | Appropriate abstraction, separation of concerns, structure consistent with the project, recorded trade-offs. | v0.1.0 |
| [`clean-code`](skills/clean-code/SKILL.md) | Naming, readability, explicit error handling, DRY without premature abstraction, no unrelated restyling. | v0.1.0 |
| [`security`](skills/security/SKILL.md) | Input validation, authn/authz, secrets, injection, secure configuration, dependencies, common web vulnerabilities. | v0.2.0 |
| [`testing`](skills/testing/SKILL.md) | Unit, integration and end-to-end tests, edge cases, isolation, meaningful assertions, no fabricated results. | v0.2.0 |
| [`production-readiness`](skills/production-readiness/SKILL.md) | Config, build, tests, security checks, logging, deployment risks, honest completion reporting. | v0.2.0 |
| [`performance`](skills/performance/SKILL.md) | Measure before and after, algorithms, queries, caching, frontend, memory, no premature optimization. | v0.3.0 |
| [`database`](skills/database/SKILL.md) | Schema, indexes, queries, transactions, integrity, safe migrations, ORM use, N+1. | v0.3.0 |
| [`api-design`](skills/api-design/SKILL.md) | Resource naming, HTTP semantics, error shape, validation, pagination, versioning, compatibility, idempotency. | v0.3.0 |
| [`accessibility`](skills/accessibility/SKILL.md) | Semantic HTML, keyboard, focus, contrast, forms, screen readers, responsive interaction. | v0.3.0 |

The release column is the roadmap: the foundation (v0.1.0) is the vertical
slice; reliability (v0.2.0) and engineering excellence (v0.3.0) build on it.
All ten skills are present in this repository and validate; see
[CHANGELOG.md](CHANGELOG.md) for what each release tag will contain.

## Installation

### With the `skills` CLI

The [`skills`](https://github.com/vercel-labs/skills) CLI (Node.js 22.20+)
discovers the `skills/` directory and copies skills into the location each
agent reads. Run from your project root:

```bash
npx skills add febrianmosii/agentic-devcraft
```

Pick one skill and one agent, or install globally:

```bash
npx skills add febrianmosii/agentic-devcraft --skill scope-control -a claude-code
npx skills add febrianmosii/agentic-devcraft -g
```

Verified by the maintainer with `skills` CLI 1.7.4 against a local clone of
this repository (installing into `.claude/skills/`). The GitHub-sourced form
is the same command with the repository name and has not been re-verified
after every change; open an issue if it fails.

### By hand

Copy any `skills/<name>/` directory into the folder your agent reads.
Common locations are listed in [docs/compatibility.md](docs/compatibility.md).
For Claude Code that is `.claude/skills/<name>/` in the project or
`~/.claude/skills/<name>/` for all projects.

```bash
git clone https://github.com/febrianmosii/agentic-devcraft
cp -r agentic-devcraft/skills/scope-control .claude/skills/
```

## Usage

Once installed, agents that support automatic skill selection load a skill
when the task matches its description. You can also name the skill
explicitly.

```
Fix the crash in sendWelcome when the user has no email. Use scope-control.
```

```
/architecture Where should the new export job live, and does it need an interface?
```

```
Before I deploy this, run production-readiness and tell me what you could
and could not verify.
```

### What changes

A before-and-after for `scope-control`, abridged from
[examples/scope-control/null-email-crash.md](examples/scope-control/null-email-crash.md):

**Without the skill.** A null-check bug fix arrives as a 70-line diff across
four files: imports re-sorted, the function signature changed for two other
callers, a one-use helper extracted into a new `utils/` file, and a
formatter config added. The report says "all tests pass"; no command was
run. One caller now breaks at runtime.

**With the skill.** The agent states the boundary first, greps for the two
callers, and lands a four-line guard clause plus one test. The report shows
the real test command and count, an explicit "outside the request: none",
and a note about a related risk it noticed but left alone.

Every skill has at least one such scenario in [`examples/`](examples/).
Scenarios are labelled `Illustrative` (written by a maintainer to show the
intended difference) or `Observed` (a recorded transcript, with the agent,
model and date). Nothing in this repository presents an illustration as a
measurement.

## Agent compatibility

The skills use only the frontmatter fields defined by the Agent Skills
specification, so they are portable across agents that implement it. Where
each agent looks for skills, how it triggers them, and what has actually
been tested are documented in [docs/compatibility.md](docs/compatibility.md).

Summary as of October 2026:

| Agent | Status |
|---|---|
| Claude Code | verified by maintainer (2.1.304, October 2026) |
| OpenAI Codex | documented by vendor, not tested by maintainer |
| Cursor | documented by vendor, not tested by maintainer |
| Gemini CLI | documented by vendor, not tested by maintainer |
| GitHub Copilot | documented by vendor, not tested by maintainer |

No claim is made about agents that are not listed.

## Architecture

```
agentic-devcraft/
├── skills/<name>/SKILL.md        # one skill per directory, spec-conformant frontmatter
├── skills/<name>/references/     # detail loaded on demand, linked from SKILL.md
├── examples/<name>/*.md          # before/after scenarios, Illustrative or Observed
├── docs/                         # authoring contract, workflow, validation, compatibility
├── scripts/validate-skills.mjs   # zero-dependency validator (Node 20+)
├── tests/                        # node:test suite for the validator + the repo itself
└── .github/workflows/ci.yml      # runs tests and validation on push and PR
```

Design choices, briefly:

- **One concern per skill, cross-cutting rules in one place.** The shared
  workflow and rule levels live in `docs/`; each skill only states what
  they mean for its concern.
- **Progressive disclosure.** `SKILL.md` stays under 500 lines (the
  validator warns at 350); detail goes in `references/`.
- **Validation is the test suite.** `npm run validate` checks frontmatter
  against the spec, required sections, links, orphaned references, example
  structure, and over-claiming phrases. `npm test` runs the validator's own
  tests and asserts the repository validates cleanly. See
  [docs/validation.md](docs/validation.md).
- **No dependencies, no CLI, no site.** The format is Markdown and the
  installer already exists.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to propose a rule, add a
skill, record an observed scenario, or report a compatibility result. The
authoring contract is in [docs/skill-authoring.md](docs/skill-authoring.md).

## License

[MIT](LICENSE).
