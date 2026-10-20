# Smells and remedies

A smell is a hint, not a verdict. Each entry names the smell, the question
that confirms it, and the proportionate remedy. Apply remedies only inside
the task's scope.

## Naming

| Smell | Confirming question | Remedy |
|---|---|---|
| Generic noun (`data`, `info`, `item`, `obj`) | Can you say what kind? | Name the kind: `invoice`, `rateLimitHeaders`. |
| Generic verb (`process`, `handle`, `manage`, `do`) | What does it actually do? | Name the effect: `parseInvoice`, `retryWithBackoff`. |
| Two names, one concept (`user`/`account`/`member`) | Does the domain distinguish them? | Pick the project's term and use it everywhere in the change. |
| One name, two concepts (`id` for both order and customer) | Would a caller confuse them? | Qualify: `orderId`, `customerId`. |
| Encoded type or scope (`strName`, `m_count`, `arrUsers`) | Does the project do this? | Follow the project; otherwise drop the encoding. |
| Negated boolean (`notFound`, `isNotValid`) | Does `if (!notFound)` appear? | Flip to positive: `found`, `isValid`. |

## Functions

| Smell | Confirming question | Remedy |
|---|---|---|
| Long function | Does it need scrolling? Does its name need "and"? | Extract named steps at the same abstraction level. |
| Flag argument | Does the body branch on the flag at the top? | Two functions, or an options object with named fields. |
| Many parameters (more than four) | Do several travel together elsewhere? | Group them into a typed object; or question whether the function does too much. |
| Output parameter | Does the function mutate an argument to return a result? | Return the value; return a tuple or object for several. |
| Deep nesting | Is the happy path indented three or more levels? | Guard clauses, early return, extract the inner block. |
| Hidden side effect | Does a getter write, a validator save, a formatter send? | Split query from command; name the effect. |

## Error handling

| Smell | Confirming question | Remedy |
|---|---|---|
| Empty catch | Would anyone know this failed? | Log with context and return a defined value, or re-throw. |
| Catch-all | Does it catch programming errors along with expected ones? | Catch the specific type; let the rest propagate. |
| Lost cause | Does the new error omit the original? | Chain or wrap: `throw new X("...", { cause })`, `raise ... from exc`. |
| Error as string | Do callers parse the message? | Typed errors or error codes. |
| Return code ignored | Is the result of `write`, `send`, `exec` unused? | Check it, or document why ignoring is safe. |
| Error path untested | Is there a test that triggers the failure? | Add one for each handled error (see `testing`). |

## Duplication

Before extracting, answer two questions:

1. **Do the copies change for the same reason?** Two validation blocks that
   enforce the same business rule do. Two loops that happen to look alike do
   not.
2. **Can the helper be named precisely?** If the best name is `helper`,
   `common` or `doStuff`, the copies are not the same thing.

Only extract when both answers are yes. Otherwise leave the duplication and
move on; it is cheaper than the wrong abstraction.

## Comments

Keep a comment when it explains:

- a constraint from outside the code (regulation, vendor quirk, protocol);
- a workaround, with a link to the issue or a description of what breaks
  without it;
- a non-obvious invariant that the code relies on;
- a decision between alternatives, briefly (link to the ADR for detail).

Delete or avoid a comment when it:

- restates the next line;
- is commented-out code (version control remembers);
- marks a TODO with no owner, reason or link;
- apologises without explaining.

## Language notes

- **JavaScript/TypeScript:** prefer `const`; avoid `any` in new code; `async`
  functions must handle rejection at some layer; match the file's module
  style (ESM vs CJS) rather than converting.
- **Python:** follow the file's existing style for typing and docstrings;
  catch specific exceptions; avoid mutable default arguments; prefer
  `pathlib` for new path code if the file already uses it.
- **PHP (Laravel and similar):** type-hint parameters and return types in new
  code when the file does; keep controllers thin; throw domain exceptions
  rather than returning `false`.
- **Go:** handle every returned `error`; wrap with `%w`; keep exported names
  documented; do not introduce interfaces before a second implementation.
- **Java/Kotlin/C#:** prefer composition over inheritance for reuse; avoid
  checked-exception swallowing; keep nullability explicit where the language
  allows.

These notes defer to the project's own style guide whenever one exists.
