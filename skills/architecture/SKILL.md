---
name: architecture
description: >-
  Guides architectural decisions in existing and new codebases: choosing the
  right level of abstraction, separating concerns, selecting design patterns
  only when they pay for themselves, keeping project structure consistent, and
  documenting trade-offs. Use when adding a module or service, introducing a
  pattern or layer, deciding where new code should live, evaluating whether a
  design is over-engineered, or when asked "how should I structure this?".
license: MIT
metadata:
  collection: agentic-devcraft
  version: "0.1.0"
---

# Architecture

## Purpose

Agents reach for structure reflexively: an interface for every class, a
repository for every table, a plugin system for two implementations. The
result is code that is harder to read than the problem it solves. The
opposite failure is just as real: business logic pasted into controllers,
one module that knows everything. This skill makes the agent choose
structure deliberately, match the structure the project already has, and
write down why.

## When to use

- Creating a new module, package, service or layer.
- Deciding where a new piece of code belongs.
- Introducing a design pattern, abstraction or dependency boundary.
- Reviewing a design proposal or an existing component for over- or
  under-engineering.
- Planning for growth: more users, more data, more contributors.

Not needed for edits inside a single function whose placement is not in
question.

## Rules

Levels: **MUST** (no deviation without a documented exception), **SHOULD**
(deviate with a one-sentence reason), **CONSIDER** (judgment call).

### MUST

- **Follow the project's existing structure before inventing a new one.**
  Prevents: two competing ways to do the same thing in one codebase.
  Applies: any new file, layer or naming scheme in a project that already has code.
  Exception: the existing structure is the documented problem the task addresses.
  Verify: the new code sits next to its siblings and follows their naming and layering; a newcomer could predict its location.

- **Introduce an abstraction only for a concrete, present need.**
  Prevents: interfaces with one implementation, factories that build one thing, config for options nobody toggles.
  Applies: interfaces, base classes, generics, plugin points, strategy objects, dependency-injection registrations.
  Exception: a second implementation is scheduled and named (for example a test double that cannot be built otherwise), or a framework requires the shape.
  Verify: every abstraction has at least two real users in the codebase or a stated, dated reason.

- **Keep business rules out of transport and persistence code.**
  Prevents: logic that cannot be tested without HTTP, a database or a UI, and that gets duplicated per entry point.
  Applies: controllers, handlers, resolvers, CLI commands, repository/ORM classes, UI components.
  Exception: trivial glue (parse input, call one function, format output).
  Verify: the rule can be unit-tested with plain function calls; the controller or handler is short enough to read in one screen.

- **Record non-obvious trade-offs where the next engineer will look.**
  Prevents: well-reasoned decisions being reverted by someone who does not know the reasoning.
  Applies: any choice between viable alternatives with lasting consequences (data model, sync vs async, library choice, caching strategy, consistency model).
  Exception: decisions fully explained by the surrounding code or an existing project convention.
  Verify: a short note exists in the ADR directory, module README, or a comment at the decision point, naming the alternatives rejected and why. See [references/decision-records.md](references/decision-records.md).

- **Never claim a design is scalable, resilient or decoupled without saying against what.**
  Prevents: vague assurances replacing analysis.
  Applies: design proposals, reports, PR descriptions.
  Exception: none.
  Verify: every such adjective is followed by a concrete load, failure mode or change scenario.

### SHOULD

- **Prefer functions and modules over classes and hierarchies when state is not shared.**
  Prevents: inheritance trees built for code reuse, which couple unrelated behaviour.
  Applies: new code in languages where both are idiomatic.
  Exception: the framework or project convention is class-based.
  Verify: no class exists only to group static functions; no inheritance deeper than one level without a stated reason.

- **Make dependencies point inward: domain code does not import framework, transport or storage code.**
  Prevents: domain logic that cannot survive a framework upgrade or migration.
  Applies: projects with a recognisable domain layer.
  Exception: small applications where a single layer is the honest architecture; do not fake layers.
  Verify: import graph of the domain module contains no framework or driver packages.

- **Choose the boring, well-understood option when two designs are close.**
  Prevents: maintenance cost from novelty: a new library, a new paradigm, a custom protocol.
  Applies: library selection, data formats, communication patterns.
  Exception: the boring option measurably fails a stated requirement.
  Verify: the report names the boring option and, if it was rejected, the measurement or constraint that ruled it out.

- **Design for the next order of magnitude, not the next three.**
  Prevents: premature sharding, queues, caches and microservices; also prevents designs that fall over at 10x.
  Applies: capacity, data volume, team size.
  Exception: known, dated growth targets from the user.
  Verify: the design states the current scale and the scale it is expected to handle without rework.

- **Keep modules cohesive: one reason to change per module.**
  Prevents: edits that ripple through unrelated code, and merge conflicts between unrelated features.
  Applies: module, package and service boundaries.
  Exception: deliberately pragmatic grouping in very small projects.
  Verify: you can describe the module's responsibility in one sentence without "and".

### CONSIDER

- **Extracting a shared module** once the same logic exists in three places and they change together.
- **A feature-based folder layout** (`orders/`, `billing/`) over a type-based one (`controllers/`, `models/`) when features outnumber layers; follow the project if it already chose.
- **Introducing an event or queue boundary** when a call has become a fan-out to several side effects with different failure characteristics.
- **Writing a one-page design note before coding** for any change that spans more than three modules.

A longer discussion of pattern selection: [references/pattern-selection.md](references/pattern-selection.md).

## Workflow

- **Understand:** map the existing structure first (`tree -L 3`, entry points, how modules depend on each other). Find the closest existing analogue to what you are about to build and read it fully.
- **Plan:** write the proposed placement and the abstractions you intend to add, each with its concrete need. List the alternative you rejected. If the plan introduces a new layer or pattern, this is the moment to ask.
- **Implement:** build the simplest version that satisfies the need. Mirror the neighbouring code's structure.
- **Verify:** check the import graph for inward direction; check that each new abstraction has its users; run existing tests and whatever architectural checks the project has (lint rules, dependency-cruiser, ArchUnit, module boundaries).
- **Report:** placement, abstractions added and why, alternatives rejected, trade-offs recorded (and where), and what scale or change the design is expected to absorb.

## Examples

**Request:** "Add Stripe as a second payment provider next to the existing PayPal integration."

Over-engineered: a `PaymentProviderFactory`, a `PaymentProviderRegistry`,
an abstract `BasePaymentProvider` with eleven lifecycle hooks, and a YAML
config for provider selection. Only two providers exist; selection is by
one field on the order.

Appropriate: a `PaymentProvider` interface with the three methods PayPal
already exposes (`charge`, `refund`, `verifyWebhook`), two implementations,
and a function that picks one by `order.provider`. The interface exists
because two real implementations now share a caller. The design note
records that a registry was rejected until a third provider appears.

**Request:** "Our Express app is 40 routes in one file. Restructure it."

Over-engineered: a hexagonal architecture with ports, adapters, use-case
classes and a DI container.

Appropriate: group routes by feature into modules that each export a
router, move validation into per-feature schema files, keep handlers thin,
and extract business logic into plain functions only where handlers already
contain it. A note explains that no domain layer was introduced because the
app has no logic independent of its HTTP shape yet.

Full scenario: [examples/architecture/second-payment-provider.md](../../examples/architecture/second-payment-provider.md).

## Anti-patterns

- **Speculative generality.** Building for requirements nobody stated. Correction: delete the unused flexibility; note the possible future need in the design note.
- **Pattern name-dropping.** Choosing "Repository", "CQRS" or "Clean Architecture" by label rather than by the problem they solve. Correction: state the forces first, then see which pattern, if any, answers them.
- **Layer theatre.** Service calls repository calls DAO, each forwarding the same arguments with no logic. Correction: collapse layers that add no behaviour.
- **Framework in the core.** ORM entities or HTTP request objects used as domain types everywhere. Correction: acceptable in small apps; in larger ones, map at the boundary.
- **Big-bang restructure.** Rewriting a module's architecture in the same change as a feature. Correction: separate the structural change from the behavioural one; land the structural change with no behaviour difference.
- **Undocumented reversal.** Replacing a design without finding out why it was chosen. Correction: look for an ADR, commit message or comment first; address its reasoning in yours.

## Verification checklist

- [ ] New code lives where the project's existing structure predicts.
- [ ] Every new abstraction has two or more real users, or a written reason.
- [ ] Business rules are callable without transport or storage.
- [ ] Domain modules do not import framework or driver packages (where a domain layer exists).
- [ ] Trade-offs with lasting consequences are recorded, and the report says where.
- [ ] Claims of scalability or decoupling name the concrete scenario they hold for.
- [ ] Existing tests and architectural checks were run; results are in the report.

## Output

The report states where the code was placed and why, lists each abstraction
introduced with the concrete need it serves, names at least one alternative
that was rejected, and points to the recorded trade-off. It does not describe
the design with unqualified adjectives, and it does not present a structural
rewrite as a side effect of a feature.
