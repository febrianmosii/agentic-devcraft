---
name: clean-code
description: >-
  Improves readability and maintainability of code being written or modified:
  precise naming, small functions with one job, reduced nesting and branching,
  explicit error handling, DRY without premature abstraction, and comments that
  explain intent rather than restate code. Use when writing new functions or
  classes, when asked to clean up, refactor, simplify or make code readable,
  or when reviewing code for maintainability.
license: MIT
metadata:
  collection: agentic-devcraft
  version: "0.1.0"
---

# Clean code

## Purpose

Code is read far more often than it is written, and an agent's output is read
by people who did not watch it being produced. This skill makes generated code
easy to follow on first reading: names say what things are, functions do one
thing, error paths are visible, and the diff does not wander into cosmetic
rewrites of code that was not part of the task.

## When to use

- Writing any new function, class, module or test.
- Explicit requests: "clean up", "refactor", "simplify", "make this readable",
  "reduce complexity".
- Reviewing a diff for maintainability.
- Fixing a bug in code whose structure made the bug possible (apply narrowly;
  see `scope-control`).

Do not use it as licence to restyle files outside the task. When the request
is a bug fix or scoped feature, `scope-control` wins on where to stop.

## Rules

Levels: **MUST** (no deviation without a documented exception), **SHOULD**
(deviate with a one-sentence reason), **CONSIDER** (judgment call).

### MUST

- **Names state what a thing is or does, in the project's vocabulary.**
  Prevents: readers decoding `data2`, `tmp`, `handle()`, `doProcess()`, or domain terms used inconsistently (`client` vs `customer` for the same entity).
  Applies: every identifier you introduce.
  Exception: conventional short names in tiny scopes (`i`, `e`, `ctx`) where the project uses them.
  Verify: a reader can predict a function's behaviour from its name and signature without opening it; the same concept has one name across the change.

- **Handle every error path explicitly.**
  Prevents: swallowed exceptions, `catch {}` blocks, ignored return codes, unhandled promise rejections, and `except: pass`.
  Applies: every call that can fail: I/O, network, parsing, external APIs, nullable results.
  Exception: a documented fire-and-forget where failure is genuinely irrelevant, with a comment saying so.
  Verify: each catch block either recovers, re-throws with context, or logs and returns a defined value; no empty handlers; no error message that loses the original cause.

- **Do not reformat or restyle code outside the lines the task changes.**
  Prevents: diffs where the real change is lost among whitespace, import order and quote-style churn.
  Applies: every edit to an existing file.
  Exception: the project enforces a formatter in CI and the file already conforms.
  Verify: `git diff -w --stat` and `git diff --stat` show similar line counts; no hunks consisting only of style changes.

- **Match the file's existing conventions, even when yours are better.**
  Prevents: files that mix two naming schemes, two error-handling styles or two module systems.
  Applies: any edit to an existing file.
  Exception: the task is to migrate the convention, and the whole file (or codebase) moves together.
  Verify: the new lines are indistinguishable in style from their neighbours.

### SHOULD

- **Keep functions to one responsibility and one level of abstraction.**
  Prevents: 200-line functions that validate, compute, persist and format, and must be read in full to change any one part.
  Applies: new functions and functions you substantially modify.
  Exception: sequential orchestration functions that only call named steps in order.
  Verify: the function body fits on a screen; its name describes everything it does; its steps are at the same level (no raw SQL next to business rules).

- **Reduce nesting with early returns and guard clauses.**
  Prevents: arrow-shaped code where the happy path is five indents deep.
  Applies: conditionals and loops you write or touch.
  Exception: languages or style guides that forbid early return.
  Verify: nesting depth of new code is three or less; the happy path reads top to bottom.

- **Remove duplication only when the copies change for the same reason.**
  Prevents: premature helpers that couple unrelated code, and three identical blocks that drift apart.
  Applies: when you see the same logic in two or more places.
  Exception: duplication across module boundaries that are meant to evolve independently (for example two bounded contexts).
  Verify: before extracting, you can name the single reason both callers would change together; after extracting, the helper has a precise name and no boolean parameters that switch behaviour.

- **Comment why, not what; delete comments that restate the code.**
  Prevents: comments that rot (`// increment i`), commented-out code, and missing explanations for genuinely surprising lines.
  Applies: every comment you add or encounter in changed lines.
  Exception: documentation comments required by the project's tooling (JSDoc, docstrings) even when the signature is self-explanatory.
  Verify: each comment answers a question the code cannot: a constraint, a workaround with a link, a non-obvious invariant, a business rule's origin.

- **Prefer explicit over clever.**
  Prevents: one-liners that need a whiteboard, nested ternaries, bitwise tricks for booleans, regex where a parser exists, implicit type coercion.
  Applies: all new code.
  Exception: performance-critical code with a measured need and a comment explaining the trick.
  Verify: a mid-level engineer unfamiliar with the code can explain each line.

- **Keep magic values named.**
  Prevents: `if (status === 3)`, `setTimeout(fn, 86400000)`, repeated string literals used as keys.
  Applies: literals with meaning beyond their value.
  Exception: zero, one, empty string, and literals used once in an obviously self-describing context.
  Verify: no unexplained numeric or string literal that a reader would have to look up.

### CONSIDER

- **Replacing boolean parameters with two functions or an enum** when callers read as `save(user, true, false)`.
- **Introducing a small type or value object** when the same group of primitives travels together through several signatures.
- **Pulling a long condition into a named predicate** (`isEligibleForRefund(order)`) when the condition is reused or hard to read inline.
- **Adding a test as the first step of a readability refactor**, so behaviour preservation is checked rather than assumed.

Language-specific notes and a longer smell catalogue:
[references/smells-and-remedies.md](references/smells-and-remedies.md).

## Workflow

- **Understand:** read the whole function or module before editing; note naming scheme, error style, formatting, and the domain vocabulary in use.
- **Plan:** for a refactor request, list the smells you will address and the behaviour that must not change. For new code, decide names and function boundaries before writing bodies.
- **Implement:** write for the reader. Name first, then fill in. Handle the error path at the moment you write the call that can fail.
- **Verify:** run the existing tests; for refactors, confirm the diff has no behaviour change you did not intend (compare outputs, re-run the same test suite, check `git diff -w`).
- **Report:** what was made more readable and how, what behaviour was preserved, how it was verified, and any smells deliberately left in place.

## Examples

Before:

```python
def proc(d, f=False):
    r = []
    for x in d:
        if x:
            if x.get("s") == 3 or (f and x.get("s") == 4):
                try:
                    r.append(fmt(x))
                except:
                    pass
    return r
```

After:

```python
SHIPPED = 3
DELIVERED = 4

def shipped_order_summaries(orders, include_delivered=False):
    allowed_statuses = {SHIPPED, DELIVERED} if include_delivered else {SHIPPED}
    summaries = []
    for order in orders:
        if not order or order.get("status") not in allowed_statuses:
            continue
        try:
            summaries.append(format_summary(order))
        except FormatError as exc:
            logger.warning("skipping order %s: %s", order.get("id"), exc)
    return summaries
```

The after version names the statuses, flattens the nesting, catches the
specific exception, logs instead of swallowing, and keeps the boolean flag
only because the two callers in the task genuinely need both modes
(a CONSIDER item would be splitting into two functions).

Full scenario: [examples/clean-code/report-generator-refactor.md](../../examples/clean-code/report-generator-refactor.md).

## Anti-patterns

- **Silent catch.** `catch (e) {}` or `except Exception: pass`. Correction: handle, re-throw with context, or log and return a defined value.
- **Abbreviation soup.** `usrMgrSvc.procReq(rq)`. Correction: full words in the project's vocabulary.
- **Flag arguments.** `render(doc, true, false, true)`. Correction: named options object, enum, or separate functions.
- **Comment as apology.** `// hack, fix later` with no issue link or reason. Correction: explain the constraint or remove the hack.
- **Refactor by rewrite.** Replacing a working function with a differently structured one in the same change as a feature. Correction: separate the refactor; keep behaviour identical and test-covered.
- **DRY at any cost.** A `utils.ts` of one-line wrappers used once each. Correction: inline; extract when a second caller appears with the same reason to change.
- **Negative naming.** `isNotDisabled`, `skipUnlessReady`. Correction: positive predicates (`isEnabled`, `isReady`).
- **Type-in-name.** `userArray`, `strName`, `IUser` in languages with good type systems. Correction: follow the project; otherwise drop the type prefix.

## Verification checklist

- [ ] Every new identifier reads as a description of its content or behaviour, using the project's terms.
- [ ] No empty or swallowing error handlers; errors keep their cause.
- [ ] New code matches the file's existing conventions.
- [ ] No cosmetic changes outside the task's lines.
- [ ] Functions you wrote or substantially changed have one responsibility and fit on a screen.
- [ ] Comments added explain why; none restate code; no commented-out code left behind.
- [ ] Existing tests pass after the change; the actual command and result are in the report.

## Output

The report names the specific readability changes (renamed X to Y because Z,
flattened the nesting in F, replaced a silent catch with logging) and states
how behaviour preservation was verified. It does not describe the result as
"cleaner" without saying what changed, and it does not list style changes
outside the task as part of the work.
