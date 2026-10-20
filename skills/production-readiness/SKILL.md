---
name: production-readiness
description: >-
  Checks whether a change is actually ready for production and reports the
  result honestly: runs the build and test suite, inspects environment
  configuration, secrets, logging, error handling at boundaries, migration
  compatibility and rollback paths, then issues a verdict that separates what
  was verified from what was not. Use when the user asks "is this ready to
  deploy", "can we ship this", "is this done", "ready for release", "go live",
  or before any deploy, release, or production handover.
license: MIT
metadata:
  collection: agentic-devcraft
  version: "0.1.0"
---

# Production readiness

## Purpose

Agents say "production ready" the way they say "done": as a closing phrase,
not a finding. The build was not run, the suite was "assumed green", the
migration drops a column the running release still reads, and the `.env`
with the real API key is in the diff. This skill turns the readiness
question into a set of checks that are actually executed, and turns the
answer into a verdict that lists what was checked, what was not, and what
does not apply. Not running a check is acceptable; claiming it ran is not.

## When to use

- The user asks whether a change, branch or release is ready to deploy,
  ship, go live, or be handed over.
- Before pushing to a branch that triggers a production deploy.
- Reviewing a pull request whose description claims readiness.
- Preparing a release note or handover for an operations team.
- Any task that ends with a migration, an infrastructure change, or a
  change to configuration read at startup.

Not needed for local experiments, throwaway scripts, or changes that will
be reviewed again before any deploy decision. There, run the tests and
report; the full verdict is noise.

## Rules

Levels: **MUST** (no deviation without a documented exception), **SHOULD**
(deviate with a one-sentence reason), **CONSIDER** (judgment call).

### MUST

- **Issue the verdict as three lists: verified, not verified, not applicable.**
  Prevents: "production ready" standing in for checks nobody ran; the reader cannot tell a skipped check from a passed one.
  Applies: every readiness answer, however short the change.
  Exception: none.
  Verify: each item in "verified" names the command or file inspected and the observed result; "not verified" states why; nothing is in both lists.

- **Run the build, type-check and test suite before answering, and report the observed output.**
  Prevents: "tests pass" based on the last run someone else did, or on reading the test files.
  Applies: any project with a build, compile, type-check or test command; find it in `package.json`, `Makefile`, `composer.json`, CI config.
  Exception: the command cannot run here (no toolchain, no database, no credentials); then it goes in "not verified" with the reason, never in "verified".
  Verify: the report quotes the command and its summary line (`42 passed, 1 skipped`, `tsc: 0 errors`, exit code).

- **Do not run destructive or irreversible operations without explicit authorization.**
  Prevents: data loss and unrecoverable state caused by a readiness check that "helpfully" migrated, truncated, deleted or force-pushed.
  Applies: migrations against shared or production databases, `DROP`/`TRUNCATE`/`DELETE` without a scoped `WHERE`, `git push --force`, deleting branches, tags, buckets, releases or backups, rotating credentials.
  Exception: the user named the operation and the target in this conversation.
  Verify: every such operation in the transcript is preceded by an explicit instruction naming it; otherwise it appears in the report as "requires authorization", not as done.

- **Keep environment-specific values out of code; require, document and validate configuration at startup.**
  Prevents: a staging URL, a local port or a developer's token shipping to production, and a missing variable failing at the first request instead of at boot.
  Applies: hostnames, ports, credentials, bucket names, feature toggles, timeouts that differ per environment.
  Exception: values that are genuinely identical in every environment and documented as such.
  Verify: `grep` for literals (`localhost`, `127.0.0.1`, `.local`, `staging`, `sk_live`, `AKIA`) finds none in shipped code; `.env.example` or the config schema lists every variable the code reads; startup fails fast with a named variable when one is missing.

- **Ship no secrets and no debug mode.**
  Prevents: credentials in the repository history, stack traces and SQL in user-facing responses, verbose logging that leaks personal data.
  Applies: `.env` files, config files, fixtures, test data, CI logs, Dockerfiles, `APP_DEBUG`, `DEBUG=True`, `NODE_ENV`, source maps on public hosts.
  Exception: none for secrets; debug output is acceptable when gated by a non-production environment check that was inspected.
  Verify: `git diff --cached --name-only` and `git log --diff-filter=A -- '*.env*'` show no secret files; a secret scanner ran if one exists (`gitleaks`, `trufflehog`, `detect-secrets`); the production config has debug off.

- **Make schema changes compatible with the code that is still running during the deploy.**
  Prevents: the window between migration and code switch (or the rollback after it) where the old release reads a column, table or enum value that no longer exists.
  Applies: any migration, index change, data backfill, or change to a serialized format shared across processes.
  Exception: the deploy has a documented maintenance window with the service stopped, and the user accepts it.
  Verify: the migration adds before it removes (expand first, contract in a later release); the previous release can run against the migrated schema; the rollback path is written down. Details: [references/deployment-risks.md](references/deployment-risks.md).

- **Surface errors at boundaries; never swallow them.**
  Prevents: failed payments, lost webhooks and silent partial writes that are discovered weeks later by a customer.
  Applies: `catch` blocks, promise handlers, queue consumers, cron jobs, HTTP clients, background workers.
  Exception: an error that is handled by a documented fallback and recorded (logged with context or counted in a metric).
  Verify: no empty `catch`, no `catch (e) { return null }` without a log, no `.catch(() => {})`; grep the diff for `catch` and read each one.

### SHOULD

- **Put a timeout on every outbound call and a limit on every retry.**
  Prevents: thread pools, connection pools and workers exhausted by one slow dependency; retry storms that turn a blip into an outage.
  Applies: HTTP clients, database and cache connections, queue publishers, SMTP, third-party SDKs.
  Exception: the client library enforces a sane default and the report says which.
  Verify: each client in the diff has an explicit timeout; retries have a maximum count and backoff; non-idempotent operations are not retried blindly.

- **Degrade gracefully when a non-critical dependency fails.**
  Prevents: the checkout page returning 500 because the recommendation service is down.
  Applies: features that are additive to the main flow: analytics, recommendations, notifications, enrichment, caching.
  Exception: the dependency is the feature.
  Verify: the main path has a stated behaviour when each optional dependency is unavailable, and that behaviour is tested or demonstrated.

- **Log with structure and context, and keep sensitive data out of logs.**
  Prevents: incidents that cannot be traced to a request, user or job, and logs that become a compliance problem.
  Applies: new log statements and error handlers.
  Exception: projects with no logging framework; then match whatever the project does and note it.
  Verify: log lines carry a request or job identifier and the relevant entity id; passwords, tokens, card numbers, full personal records and request bodies with credentials do not appear.

- **Run the dependency audit when the tooling exists.**
  Prevents: shipping a dependency with a known exploitable vulnerability that one command would have flagged.
  Applies: `npm audit`, `pnpm audit`, `composer audit`, `pip-audit`, `cargo audit`, `govulncheck`, `bundle audit`, or the project's own scanner.
  Exception: no tooling is available offline; report that it was not run.
  Verify: the command and its summary are in the report; high or critical findings are listed with a decision each.

- **Back up before any destructive step and state the rollback path.**
  Prevents: a migration or data fix that cannot be undone.
  Applies: migrations that alter or drop, bulk updates, file or object deletions, infrastructure replacements.
  Exception: fully reversible operations (adding a nullable column, creating an index concurrently) when the report says why.
  Verify: the backup command and its location are recorded; the rollback is either `migrate:rollback`/`down` that was tested, a restore from the named backup, or a redeploy of the previous release.

- **Name what breaks at ten times the current load and the single points of failure the change adds.**
  Prevents: a feature that works for one tenant and takes the database down for the fleet.
  Applies: new queries, loops over collections, synchronous calls to external services, in-memory caches, file writes.
  Exception: changes with no runtime path (docs, tests, dead-code removal).
  Verify: the report lists the hot path, the query plan or pagination strategy where relevant, and each new external dependency with its failure behaviour.

### CONSIDER

- **Putting the new behaviour behind a feature flag** when it is user-facing, hard to roll back by redeploy, or should be enabled per tenant.
- **Checking the health endpoint, readiness probe and metrics** after the change if the project has them; a new dependency may need to be reflected in the readiness probe, not the liveness probe.
- **Running a smoke test against a staging or preview environment** when one exists and the change touches configuration, infrastructure or a migration.
- **Confirming zero-downtime constraints with the deploy pipeline** (rolling, blue/green, symlink switch, long-running workers that keep old code) before declaring a migration safe.

## Workflow

- **Understand:** find the project's build, type-check, test, lint and audit commands (`package.json` scripts, `Makefile`, `composer.json`, `.github/workflows/*`, `Dockerfile`). Find how it is deployed and what runs during a deploy (migrations, cache clears, workers). Identify what the change touches: code only, config, schema, infrastructure.
- **Plan:** write the check list for this change before running anything, using [references/readiness-checklist.md](references/readiness-checklist.md). Mark upfront what cannot run here and why. Identify any destructive step and decide whether it needs authorization.
- **Implement:** fix only what the checks reveal and the task covers; a readiness review is not a licence to refactor. Record each finding with file and line.
- **Verify:** run every runnable check and capture the summary line. Read every `catch`, every new config key, every migration. Never mark an item verified from memory or from reading a CI badge.
- **Report:** the three-list verdict, the commands run with their results, the findings that block, the findings that do not, and the authorization requests for anything destructive.

## Examples

**Request:** "Is the new CSV export ready to deploy?"

Before:

> Done, production ready! Build passes, tests pass, migration included,
> no security issues.

Nothing in that report can be checked. The reader does not know which
command ran, whether the migration was reviewed, or what "no security
issues" means.

After:

> **Verdict: not ready. One blocking finding.**
>
> Verified:
> - `npm run build` → exit 0, 0 type errors.
> - `npm test` → 212 passed, 0 failed, 3 skipped (pre-existing skips in `legacy/`).
> - `npm audit --omit=dev` → 0 high, 0 critical.
> - No secrets in diff (`gitleaks detect --staged` → 0 leaks); `.env.example` lists the new `EXPORT_BUCKET` variable; `config/export.js` throws at boot if it is missing.
> - Export job has a 30 s timeout per S3 call and a maximum of 3 retries with backoff.
>
> Not verified:
> - Behaviour under a 2 GB export: no fixture that size; memory use not measured. Streaming is used, so the risk is low, but unmeasured.
> - Staging smoke test: no staging environment reachable from here.
>
> Not applicable:
> - Feature flag: export is admin-only and can be disabled by removing the route.
>
> Blocking:
> - `migrations/0042_drop_legacy_format.js` drops `exports.format`, which `ExportController.download()` in the current release still reads. Running this migration during a rolling deploy breaks the old pods until the switch completes. Fix: split into add-and-backfill now, drop in the next release. Not run; requires authorization to run any migration against a shared database.

Full scenario: [examples/production-readiness/friday-export-deploy.md](../../examples/production-readiness/friday-export-deploy.md).

## Anti-patterns

- **Checklist theatre.** Pasting a readiness checklist with every box ticked and no evidence. Correction: each tick names a command and a result, or moves to "not verified".
- **Green by assumption.** "Tests pass" because CI was green on a previous commit or because the test files look right. Correction: run the suite on the current tree and quote the summary.
- **Verdict inflation.** Reporting "ready" when the honest answer is "ready except for X". Correction: lead with the blocking findings; the verdict is only as strong as its weakest unverified item.
- **Config by hope.** A new environment variable read with a silent fallback (`process.env.BUCKET || "dev-bucket"`). Correction: no fallback for environment-specific values; validate at startup and fail with the variable name.
- **Silent catch.** `try { await notify() } catch {}` to "make it robust". Correction: log with context, count it, or let it propagate; decide which and say why.
- **Drop-then-deploy.** A migration that renames or drops a column in the same release that stops using it. Correction: expand in this release, contract in the next; see [references/deployment-risks.md](references/deployment-risks.md).
- **Rollback on paper.** "Rollback: revert the commit" for a change that includes a migration or a data backfill. Correction: name the backup, the down migration or the restore procedure, and whether it was exercised.
- **Helpful destruction.** Running the migration, clearing the queue or deleting the stale bucket "as part of the check". Correction: readiness checks read and run tests; anything irreversible waits for an explicit instruction.

## Verification checklist

- [ ] Build, type-check and test commands were run on the current tree; summary lines are quoted.
- [ ] Every configuration value the change reads is documented, has no environment-specific fallback, and is validated at startup.
- [ ] No secret file or credential literal is in the diff or history; debug mode is off in production config.
- [ ] Dependency audit ran, or the report says it could not.
- [ ] Each `catch` in the diff logs, counts or rethrows; each outbound call has a timeout; each retry has a limit.
- [ ] Migrations are compatible with the currently deployed release; backup and rollback are named.
- [ ] Logs added carry context and no sensitive data; health and metrics reflect new dependencies where they exist.
- [ ] Behaviour at 10x load and new single points of failure are stated.
- [ ] No destructive or irreversible operation was run without an explicit instruction.
- [ ] The verdict has three lists (verified / not verified / not applicable) and leads with blocking findings.

## Output

The report opens with a one-line verdict (ready, ready with conditions, not
ready) followed by the blocking findings. It then lists what was verified,
each with the command or file and the observed result; what was not
verified, each with the reason; and what does not apply, each with why. It
names any backup taken and the rollback path. It must never say "production
ready" without those lists, never present a check as run when it was not,
and never report a destructive operation as done unless the user authorized
it by name.
