# Agent workflow

Every Agentic DevCraft skill assumes the same five-step loop. Skills do not
repeat this document; their `Workflow` section only states what the loop means
for their specific concern.

```
Understand → Plan → Implement → Verify → Report
```

Scale the effort to the task. A one-line typo fix needs a glance, a diff and a
sentence. A schema change needs the full loop. Skipping a step is fine;
pretending a step happened is not.

## Understand

Inspect before proposing. Read the files the task names and the code that
calls into them. Identify the conventions already in use: naming, error
handling, test layout, how configuration is read, how the project is built and
tested.

Questions to answer before planning:

- What exactly is being asked, and what is explicitly *not* being asked?
- Which files are genuinely involved?
- What existing behaviour must survive unchanged?
- Is there a test, build, or lint command available? Which one?

If the request is ambiguous in a way that changes the implementation, ask.
Otherwise state the assumption and proceed.

## Plan

Pick the smallest implementation that fully satisfies the request and matches
the project's architecture. Name the risks: data loss, behaviour change for
other callers, security impact, migration ordering.

Resist adding anything the task did not ask for. If an improvement is clearly
warranted, note it for the report instead of doing it.

## Implement

Make focused changes. Follow the conventions found in step one even when a
different style is preferable in the abstract. Do not reformat or reorganise
code outside the lines you need to touch. Do not add dependencies without a
reason you can defend in the report.

## Verify

Run the relevant verification that exists: tests, type checks, linters,
builds, a manual request against a dev server. Prefer the project's own
commands over invented ones.

Rules that are absolute:

- Never state that a command, test, scan or build passed unless it was
  executed and its output was observed.
- If verification cannot run (no environment, missing credentials, missing
  tooling), say so explicitly and say what was checked instead.
- If verification fails, report the failure with the relevant output. Do not
  silence or delete a failing test to make the run green.

## Report

Concise and honest. For a non-trivial change include:

1. What changed, by file or by behaviour.
2. What was verified, with the actual command and the actual result.
3. What was not verified and why.
4. Remaining risks, open questions, and anything deliberately left out of
   scope.

For trivial changes a single sentence that covers points 1 and 2 is enough.
Never pad a report; never invent a verification result to fill one.
