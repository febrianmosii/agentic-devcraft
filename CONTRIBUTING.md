# Contributing

Thanks for considering a contribution. This project is maintained by one
person in spare time, so the process is deliberately light and the bar for
*content* is deliberately high.

## Ground rules

- Every rule must name a concrete failure it prevents. "Write clean code"
  is not a rule. "Do not reformat lines the task does not change" is.
- Nothing in the repository may claim a result that was not observed. This
  applies to example scenarios, compatibility statements and benchmark-like
  language. The validator enforces part of this; reviewers enforce the rest.
- Prefer editing an existing skill over adding a new one. Ten focused skills
  are easier to keep coherent than thirty overlapping ones.
- English, imperative mood, no emoji, no marketing tone.

## Setup

```bash
git clone https://github.com/febrianmosii/agentic-devcraft
cd agentic-devcraft
npm test            # runs the validator's tests and validates the repository
npm run validate    # validator only
```

Node.js 20 or newer. There are no dependencies to install.

## Proposing a rule change

Open a pull request that edits the skill. In the description, state:

1. Which level the rule is (`MUST`, `SHOULD`, `CONSIDER`) and why that level.
2. The failure it prevents, ideally with a short real or realistic example.
3. When an exception is reasonable.

Rules that are preferences (formatting, a favourite library, a paradigm)
will be declined with thanks.

## Adding a skill

Read [docs/skill-authoring.md](docs/skill-authoring.md) first; it is the
contract. Then:

1. Open an issue describing the concern the skill covers and why it does
   not fit an existing skill.
2. Create `skills/<name>/SKILL.md` with the required sections, plus
   `references/` for detail and at least one scenario in
   `examples/<name>/`.
3. Run `npm test` until it is clean, including warnings.
4. Add the skill to the table in `README.md` and a line in `CHANGELOG.md`
   under *Unreleased*.

## Recording an observed scenario

Illustrative scenarios show intent. Observed scenarios are evidence, and they
are more valuable. To add one:

1. Run the same task twice with a real agent: once without the skill
   installed, once with it.
2. Save both transcripts, trimmed to the relevant parts (no secrets, no
   private code you are not allowed to share).
3. Create `examples/<skill>/<scenario>.md` with `**Status:** Observed` and
   `**Observed with:** <agent>, <model>, <date>`.
4. Keep the *Why it matters* section factual: what differed, not how much
   better it was in general.

## Reporting a compatibility result

If you installed the skills in an agent listed as `documented` or
`untested` in [docs/compatibility.md](docs/compatibility.md), open an issue
using the *Compatibility report* template with the agent, version, install
path, and what you observed. Working *and* non-working reports are useful.

## Pull request checklist

- `npm test` passes locally.
- Changes are limited to the skill or document the PR is about.
- No new dependencies.
- No compatibility or result claims beyond what was observed.
- `CHANGELOG.md` updated under *Unreleased* for user-visible changes.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
