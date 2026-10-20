---
name: scope-control
description: >-
  Keeps code changes inside the boundaries of the requested task: identifies the
  files that are genuinely involved, preserves existing behaviour, blocks
  drive-by refactors and reformatting, and requires explicit justification for
  any change outside the request. Use when fixing a bug, implementing a scoped
  feature, reviewing a diff for unrelated changes, or whenever the user says
  "only", "just", "minimal", or "don't touch anything else".
license: MIT
metadata:
  collection: agentic-devcraft
  version: "0.1.0"
---

# Scope control

## Purpose

Coding agents drift. Asked to fix a null check, they rename three variables,
reorder imports, "modernise" a loop and add a helper nobody requested. Each
extra change widens the review, hides the real fix in noise, and introduces
risk the user did not sign up for. This skill keeps the diff equal to the
task: nothing the request needs is missing, nothing it did not ask for is
present.

## When to use

- Bug fixes, especially in unfamiliar code.
- Features with a clear boundary ("add a `--json` flag", "expose the endpoint").
- Any task where the user signals minimalism: *only*, *just*, *small*,
  *minimal*, *don't refactor*, *leave the rest*.
- Reviewing your own diff before reporting completion.

Not the right skill for an explicitly requested refactor or cleanup. There,
use `clean-code` and `architecture`, and let this skill only guard the
*edges* of the agreed refactor.

## Rules

Levels: **MUST** (no deviation without a documented exception), **SHOULD**
(deviate with a one-sentence reason), **CONSIDER** (judgment call).

### MUST

- **State the task boundary before editing.**
  Prevents: solving a neighbouring problem instead of the stated one.
  Applies: every task that modifies code.
  Exception: single-line fixes where the boundary is self-evident.
  Verify: the plan names what is in scope and at least one thing deliberately out of scope.

- **Change only the lines the task requires.**
  Prevents: reformatting, import reordering, renames and whitespace churn that bury the real change.
  Applies: every edit to an existing file.
  Exception: the project's formatter runs on save and the user has accepted that; or a touched line cannot compile without an adjacent change.
  Verify: every hunk in `git diff` can be traced to the request in one sentence.

- **Preserve existing behaviour outside the target.**
  Prevents: silent regressions for callers you did not look at.
  Applies: whenever a changed function, class, query or config value has more than one caller.
  Exception: the task is explicitly to change that behaviour.
  Verify: callers were listed (grep or IDE references) and their expectations still hold; existing tests still pass.

- **Do not add, upgrade or remove dependencies unless the task requires it.**
  Prevents: supply-chain exposure, lockfile churn and build breakage unrelated to the request.
  Applies: package manifests, lockfiles, vendored code.
  Exception: the fix is impossible without the dependency, and the report says so.
  Verify: manifest and lockfile diffs are empty or explained.

- **Report every out-of-scope change separately, with a reason.**
  Prevents: unreviewed changes slipping in under the task's label.
  Applies: any hunk that fails the one-sentence traceability test.
  Exception: none; if it cannot be justified, revert it.
  Verify: the final report has an explicit "outside the request" list (possibly empty).

### SHOULD

- **Prefer fixing at the point of failure over restructuring around it.**
  Prevents: architectural changes smuggled in as bug fixes.
  Applies: bug fixes.
  Exception: the failure is a symptom of a design flaw and the user agrees to address the flaw.
  Verify: the fix touches the module where the defect lives, not its neighbours.

- **Record tempting improvements instead of making them.**
  Prevents: loss of good observations and the urge to act on them now.
  Applies: whenever you notice dead code, a smell, a missing test or an outdated comment outside the task.
  Exception: a one-word typo in a comment on a line you are already changing.
  Verify: the report has a "noticed, not changed" section when applicable.

- **Keep new files to the minimum the task needs.**
  Prevents: speculative modules, abstractions and utilities with a single caller.
  Applies: any time you create a file.
  Exception: the project convention requires a file per unit (for example one test file per source file).
  Verify: each new file is referenced by the change and would be missed if deleted.

- **Match the request's scale.**
  Prevents: an elaborate solution for a small ask, or a hacky one for a large ask.
  Applies: planning.
  Exception: the user explicitly asks for a thorough treatment.
  Verify: the diff size is proportionate to the problem; a reviewer would not ask "why is this so big?"

### CONSIDER

- **Splitting an unrelated but valuable fix into a separate change** when it is small, independently testable and the user is likely to want it.
- **Asking before touching shared infrastructure** (CI config, build scripts, shared base classes) even when the task technically requires it.
- **Leaving a short TODO with context** instead of fixing a tangential issue, when the project uses TODOs.

## Workflow

- **Understand:** read the request twice; write the boundary as one sentence ("in: X; out: Y"). Locate the relevant files by following the failure or feature, not by browsing.
- **Plan:** list the files to touch. If the list grows beyond what the request implies, stop and ask whether the wider change is wanted.
- **Implement:** edit, then immediately re-read the hunk and ask "did the task need this line?".
- **Verify:** review `git diff --stat` and the full diff against the boundary. Run the tests that cover the touched code.
- **Report:** changes in scope, verification run, the out-of-scope list (even if empty), and anything noticed but left alone.

Details and a diff-review procedure: [references/diff-review.md](references/diff-review.md).

## Examples

**Request:** "Fix the crash when `user.email` is null in `sendWelcome`."

Out of scope, even though tempting:

```diff
- import { sendMail } from "../mail";
- import { logger } from "../log";
+ import { logger } from "../log";
+ import { sendMail } from "../mail";
```

In scope:

```diff
  export async function sendWelcome(user) {
+   if (!user.email) {
+     logger.warn("sendWelcome skipped: user has no email", { userId: user.id });
+     return;
+   }
    await sendMail(user.email, template("welcome", user));
  }
```

Report fragment: "Changed `sendWelcome` to skip and log when email is null.
Ran `npm test -- mail` (14 passed). Outside the request: none. Noticed, not
changed: `template()` is also called with a possibly-null `user.locale`."

A full scenario: [examples/scope-control/null-email-crash.md](../../examples/scope-control/null-email-crash.md).

## Anti-patterns

- **"While I was in there."** Fixing adjacent code because it was visible. Correction: note it in the report; do not touch it.
- **Formatter wash.** Running a formatter over a file that was not formatted before, producing a 300-line diff for a 3-line fix. Correction: format only the lines you changed, or not at all.
- **Helper creep.** Extracting a function used once "for readability". Correction: inline it; extraction needs two callers or a clear naming win.
- **Convention upgrade.** Converting callbacks to async/await, `var` to `const`, or class components to hooks in the file you are fixing. Correction: match the surrounding style.
- **Silent API change.** Changing a function signature and updating "all" callers from memory. Correction: grep for callers, list them, and confirm each one.
- **Scope by omission.** Fixing the reported case but not the sibling case the request clearly covers ("the crash on null email" also covers empty string if the mail library treats them alike). Correction: the boundary must cover the whole request, not just the reproduction.

## Verification checklist

- [ ] The boundary (in/out) was stated before editing.
- [ ] Every hunk in the diff traces to the request in one sentence.
- [ ] Manifest and lockfile are unchanged, or the change is justified.
- [ ] Callers of changed symbols were enumerated and still behave as before.
- [ ] Relevant tests were run and the actual result is in the report.
- [ ] The report lists out-of-scope changes (possibly "none") and observations left alone.

## Output

The report must separate three things: what the task required and was done,
what was changed beyond the task and why, and what was noticed but
deliberately left untouched. It must never describe an out-of-scope change as
part of the fix, and must never claim a test run that did not happen.
