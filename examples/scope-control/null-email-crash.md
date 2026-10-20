# Null email crash in `sendWelcome`

**Skill:** scope-control
**Status:** Illustrative

This scenario was written by a maintainer to show the behaviour the skill is
designed to produce. It is not a recorded transcript.

## Task

> `sendWelcome` throws `TypeError: Cannot read properties of null (reading
> 'toLowerCase')` when a user signs up through the SSO provider that does not
> return an email. Fix the crash.

Relevant code (`src/onboarding/welcome.js`):

```js
import { sendMail } from "../mail";
import { logger } from "../log";
import { template } from "./templates";

export async function sendWelcome(user) {
  await sendMail(user.email, template("welcome", user));
}
```

## Without the skill

A typical unconstrained response touches four files and produces a 70-line
diff:

- Sorts imports alphabetically in `welcome.js`.
- Converts `sendWelcome` to accept a destructured `{ email, id }` parameter,
  which changes the signature for two other callers.
- Adds a new `src/utils/assert.js` with a generic `assertPresent()` helper
  used once.
- Rewrites `template()` to return `null` on missing data "for consistency".
- Adds a `.prettierrc` because "the repo had no formatter config".

Report: "Fixed the crash and cleaned up the onboarding module. All tests
pass." No test command was shown. One of the two other callers of
`sendWelcome` passes a `User` model instance, not a plain object, and now
breaks at runtime.

## With the skill

The agent states the boundary first:

> In scope: `sendWelcome` must not throw when `user.email` is null or
> undefined. Out of scope: import order, other callers' calling convention,
> `template()` internals, formatter configuration.

It greps for callers (`sendWelcome(` appears in two places) and confirms both
pass a user object with an optional `email`. The diff is one hunk:

```diff
 export async function sendWelcome(user) {
+  if (!user.email) {
+    logger.warn("sendWelcome skipped: user has no email", { userId: user.id });
+    return;
+  }
   await sendMail(user.email, template("welcome", user));
 }
```

It adds one test next to the existing ones in `welcome.test.js` covering the
null case, runs the suite for that module, and reports:

> Changed `sendWelcome` to skip sending and log a warning when `user.email`
> is missing. Added a test for the null case.
> Verified: `npm test -- welcome` → 6 passed (was 5).
> Outside the request: none.
> Noticed, not changed: `template("welcome", user)` reads `user.locale`
> without a fallback; guest users may hit a similar crash there.

## Why it matters

The scoped diff is reviewable in thirty seconds and introduces no new risk.
The unconstrained diff changed a public signature, added an unused
abstraction, altered another module's contract and introduced tooling, all
under the label "fix the crash". The second caller regression would have
reached production because the report claimed a passing test run that never
happened. The skill does not make the agent less capable; it makes the
agent's extra observations land in the report, where a human can decide on
them.
