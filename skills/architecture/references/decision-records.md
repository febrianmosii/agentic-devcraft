# Recording architectural decisions

The point is not ceremony. The point is that the next person who touches the
code can find out *why* before changing it.

## Where to write

Use whatever the project already uses, in this order of preference:

1. An existing `docs/adr/` or `docs/decisions/` directory.
2. The module's `README.md`, under a "Design notes" heading.
3. A comment block at the decision point in code, when the decision is local
   to one file.
4. The pull request description, when none of the above exist and the
   project treats PRs as its record.

Do not create an ADR directory for a project that has none unless the user
asks or the decision clearly outlives any one module.

## Minimal template

```markdown
# <Decision in one sentence>

Date: 2026-10-20
Status: accepted

## Context
What forces made this decision necessary. Two to five sentences.

## Decision
What was chosen.

## Alternatives considered
- <Alternative>: why it was rejected.
- <Alternative>: why it was rejected.

## Consequences
What becomes easier, what becomes harder, what to revisit and when.
```

## What makes a decision worth recording

- Two or more viable options existed.
- The choice affects more than one module, or is expensive to reverse.
- A reasonable engineer could pick differently without the context.

Routine choices that follow an existing convention do not need a record.

## Writing the "alternatives" section honestly

Name the alternative you actually found attractive, not a straw man. "We
rejected a message queue because the current volume is 200 events per day,
retries are not required, and a synchronous call with a 5s timeout meets the
latency target" is useful. "We rejected over-engineering" is not.
