# Selecting a pattern (or not)

A design pattern is a named answer to a recurring set of forces. Start with
the forces. If you cannot name them, you do not need the pattern yet.

## Procedure

1. **Write the forces in plain language.** "Two providers share a caller and
   will be selected at runtime." "Side effects after checkout have different
   failure modes and retry needs." "Three modules parse the same config."
2. **Look for the existing answer in the codebase.** Most projects already
   solved the shape once. Reuse it even if you would have chosen differently.
3. **Pick the smallest construct that resolves the forces.** A function, then
   a module, then an interface, then a class hierarchy, then a framework
   feature, then a new library. Move down the list only when the previous
   step demonstrably fails.
4. **Name the exit.** How would this be removed or replaced if the forces
   change? If the answer is "rewrite everything", the pattern is too deep.

## Common forces and proportionate answers

| Force | Disproportionate | Proportionate |
|---|---|---|
| Two implementations of one capability | Registry + factory + config | Interface with two implementations and a selector function |
| Same validation in three handlers | Validation framework | A shared schema or validator function |
| One slow external call | Message queue + worker fleet | Async call with timeout; queue when retries and backpressure are real |
| Config read in many places | Config service with DI | A typed config object built once at startup |
| Feature flags for two flags | Flag platform integration | A small `flags` module reading env or a table |
| Need to swap database "someday" | Repository per table + unit of work | Keep SQL in one module per aggregate; swap when "someday" has a date |
| Growing switch statement over a type | Visitor pattern | Polymorphism if types own behaviour; a lookup map if behaviour is data |

## Layering without theatre

A layer earns its place when it hides something: a protocol, a vendor, a
transaction boundary, a consistency rule. A layer that forwards arguments
unchanged hides nothing and costs a file, a test and a mental hop.

Test: delete the layer in your head. If every caller would now talk to the
layer beneath with identical code, the layer is theatre.

## Dependency direction

Stable, high-value code (domain rules) should not depend on volatile,
low-value code (frameworks, drivers, UI). Where a project has a real domain
layer, enforce this with whatever the ecosystem offers: ESLint
`no-restricted-imports`, `dependency-cruiser`, ArchUnit, `import-linter`,
Go internal packages, or a documented convention checked in review.

Where a project has no domain layer, do not invent one for a single feature.
A `services/` folder with plain functions that take and return data is a
fine first step and is honest about the application's current shape.

## Scale

Ask three questions and write the answers down:

- What is the current load, data size and team size?
- What is the next order of magnitude, and when is it expected?
- Which single component breaks first at that point?

Design so the first component to break can be replaced without rewriting
its neighbours. Do not pre-build the replacement.
