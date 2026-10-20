# Reviewing your own diff for scope

Run this before reporting completion on any change that touches more than one
hunk.

## 1. Stat first

```
git diff --stat
```

Questions:

- Does every listed file belong to the boundary you stated? A file you did
  not plan to touch is a flag, not necessarily a fault.
- Is any file's change count out of proportion with the task? Twenty lines
  for a one-line fix usually means formatting or an unrelated edit.
- Are `package.json`, `composer.json`, `requirements*.txt`, `go.mod`,
  `Cargo.toml` or their lockfiles present? If yes, justify or revert.

## 2. Walk every hunk

```
git diff
```

For each hunk, say in one sentence how the request needs it. Acceptable
answers:

- "Implements the requested behaviour."
- "Required so the change compiles / passes type check."
- "Updates a caller of the changed function."
- "Test for the requested behaviour."

Unacceptable answers, which mean revert or move to the "outside the request"
list:

- "Cleaner this way."
- "Modern syntax."
- "The formatter did it."
- "Noticed while reading."

## 3. Check for invisible scope

Changes that do not show in a diff but still widen scope:

- Deleting or renaming files (check `git status`).
- Changing generated files or snapshots (check whether they regenerate
  deterministically).
- Changing environment examples, CI configuration, or build scripts.
- Running a migration or seed against a shared database.

## 4. Write the out-of-scope list

Even when empty. Format:

```
Outside the request:
- (none)

Noticed, not changed:
- `template()` accepts a null locale; may crash for guest users.
```

## When the boundary itself is wrong

Sometimes the honest fix is bigger than the request. Signs:

- The reported symptom has three sibling symptoms from the same cause.
- The minimal fix would add a special case that contradicts the module's
  design.
- Fixing it properly requires a behaviour change for other callers.

Do not expand the scope silently. Deliver the minimal fix if it is safe,
explain why a wider change is warranted, and let the user decide. If the
minimal fix is *not* safe (it would corrupt data or hide an error), stop and
ask before implementing.
