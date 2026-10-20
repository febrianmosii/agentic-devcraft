# Adding a second payment provider

**Skill:** architecture
**Status:** Illustrative

Written by a maintainer to show the intended difference. Not a recorded
transcript.

## Task

> We charge customers through PayPal today (`src/payments/paypal.ts`,
> ~180 lines, called from `checkout.ts`). Add Stripe as a second provider.
> Each merchant account is configured with one provider.

Existing shape: `paypal.ts` exports `charge()`, `refund()` and
`verifyWebhook()`. `checkout.ts` imports them directly.

## Without the skill

The agent produces:

- `PaymentProvider` abstract class with eleven methods (`authorize`,
  `capture`, `void`, `charge`, `refund`, `partialRefund`, `verifyWebhook`,
  `listTransactions`, `healthCheck`, `onInit`, `onShutdown`). PayPal
  implements three; the other eight throw `NotImplementedError`.
- `PaymentProviderFactory` and `PaymentProviderRegistry` singletons.
- `payments.config.yaml` plus a loader, so providers can be "added without
  code changes".
- A `plugins/` directory convention documented in a new `ARCHITECTURE.md`.
- `checkout.ts` rewritten to resolve the provider through the registry via a
  dependency-injection container that the project did not previously use.

Report: "Implemented a scalable, extensible payment architecture that
decouples checkout from providers." 19 files changed. The behaviour the
merchant actually needed (pick Stripe when `merchant.provider === "stripe"`)
is in there, somewhere.

## With the skill

The agent reads `paypal.ts` and `checkout.ts`, notes that the project has no
DI container and uses plain modules everywhere, and writes the plan:

> Placement: `src/payments/stripe.ts` next to `paypal.ts`.
> Abstraction: a `PaymentProvider` interface with exactly the three methods
> both providers need, because two real implementations now share a caller.
> Selection: `getProvider(merchant)` in `src/payments/index.ts` returning
> one of the two modules.
> Rejected: registry/factory (no third provider is planned; a `switch` over
> two values is clearer), config-file driven loading (providers are code, not
> configuration), DI container (not used anywhere else in the project).

The diff adds `stripe.ts`, an `index.ts` with the interface and selector,
changes two import lines in `checkout.ts`, and adds tests for the selector
and for Stripe's webhook verification. A "Design notes" section in
`src/payments/README.md` records the rejected registry and the trigger for
revisiting it ("when a third provider is scheduled").

Report:

> Added Stripe at `src/payments/stripe.ts` mirroring the PayPal module.
> Introduced `PaymentProvider` (3 methods) because two implementations now
> exist; `checkout.ts` selects via `getProvider(merchant)`.
> Rejected: registry/factory, YAML-driven loading, DI container (reasons in
> `src/payments/README.md`).
> Verified: `npm test` → 41 passed, 0 failed. `npx tsc --noEmit` clean.
> Scale: handles any number of merchants; adding a third provider means one
> module plus one `case`. Revisit the registry idea at that point.

## Why it matters

Both versions make Stripe work. The first one makes every future change to
payments go through a factory, a registry, a config loader and a container
that exist for no present reason, and introduces a DI style foreign to the
rest of the codebase. The second one adds exactly the structure the second
implementation requires, records why it stopped there, and names the
condition under which more structure becomes worthwhile. Reviewers can read
it in a few minutes and the design reasoning survives the author.
