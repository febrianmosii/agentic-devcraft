# Rename `users.fullname` and add a `status` column on a large table

**Skill:** database
**Status:** Illustrative

This scenario was written by a maintainer to show the behaviour the skill is
designed to produce. It is not a recorded transcript.

## Task

> Rename `users.fullname` to `users.full_name` (the rest of the schema uses
> snake_case) and add a `status` column that is `active` for everyone today
> and must always be set. Ship it this sprint.

Context the agent can discover: Laravel app on PostgreSQL, deployed by a
GitHub Actions workflow that runs `php artisan migrate` and then rolls new
containers across three instances over a few minutes. `users` has roughly
twenty million rows according to `pg_class.reltuples`. `User` is an Eloquent
model with `$fillable` listing `fullname`, read in forty places. The agent has
SSH access to the production box because a previous task set it up.

## Without the skill

A single migration:

```php
Schema::table('users', function (Blueprint $table) {
    $table->renameColumn('fullname', 'full_name');
    $table->string('status')->notNull();
});
```

Plus a find-and-replace of `fullname` with `full_name` across the codebase,
and a `down()` that renames back and drops `status`.

Consequences:

- `migrate` runs before the new containers are up. For the length of the
  rollout every old instance fails on `SELECT ... fullname` with an undefined
  column error. Login breaks for every user until the rollout finishes.
- `ADD COLUMN status varchar NOT NULL` without a default is rejected by
  PostgreSQL because existing rows would violate it. The agent "fixes" it by
  adding `->default('active')`. That works in PostgreSQL 11+ as a catalog
  change, but the migration also runs inside Laravel's transaction, holding
  `ACCESS EXCLUSIVE` on `users` for the rename, which blocks every reader
  until commit.
- To "make sure it works", the agent runs `php artisan migrate` over SSH on
  production because the deploy workflow was slow to start. The deploy then
  runs it again; the second run is a no-op, but the first one was unauthorised.
- No `CHECK` or enum constrains `status`; `'Active'` and `'activ'` appear
  within a week.

Report: "Renamed the column, added status, updated all usages, migration
applied successfully." No mention of the rollout gap, the lock, or the manual
production run.

## With the skill

The agent reads the schema and the deploy workflow first and states the plan:

> `users` is about 20M rows (`reltuples`), deploy is rolling, and
> `migrate` runs before the new code is on all instances. A rename in place
> breaks old instances during rollout, so this is three releases
> (expand/contract). `status` must be `NOT NULL` with a closed value set, so
> it gets a `CHECK` constraint, added without a long lock. Nothing runs against
> production until you say so; the deploy workflow will apply the migrations.

Release 1, migration (runs in seconds; catalog changes only):

```php
Schema::table('users', function (Blueprint $table) {
    $table->string('full_name')->nullable();
    $table->string('status', 20)->nullable();
});
```

Release 1, model: `full_name` and `status` added to `$fillable`; a saving
hook writes `full_name = fullname` and defaults `status` to `'active'` on
create. Reads still use `fullname`. A resumable Artisan command backfills in
batches of 5000 ordered by `id`, with a short sleep between batches, logging
the last id:

```sql
UPDATE users SET full_name = fullname, status = COALESCE(status, 'active')
WHERE id > :last_id AND id <= :last_id + 5000
  AND (full_name IS NULL OR status IS NULL);
```

Release 2 (after release 1 is on every instance and the backfill reports
zero remaining): reads switch to `full_name`; writes to `fullname` continue.
Migration, with `$withinTransaction = false`:

```sql
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('active', 'suspended', 'deleted')) NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_not_null
  CHECK (status IS NOT NULL) NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT users_status_not_null;
ALTER TABLE users ALTER COLUMN status SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT users_status_not_null;
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'active';
```

Release 3 (after release 2 is everywhere and no code references `fullname`,
checked with `grep -rn fullname app/ resources/ database/`):

```php
Schema::table('users', fn (Blueprint $t) => $t->dropColumn('fullname'));
```

Its `down()` recreates `fullname` as nullable and the file states that the
data is not restored by the migration; the backup taken by the deploy script
before this release is the recovery path.

Each migration's `down()` is run (`migrate` then `migrate:rollback` then
`migrate`) against a local copy. The report for release 1:

> Added nullable `full_name` and `status` (catalog-only, no table rewrite).
> Dual-write in `User::saving`. Backfill command `users:backfill-names`,
> batches of 5000 by `id`, resumable from `--from`. Reads unchanged this
> release.
> Verified: `php artisan migrate && migrate:rollback && migrate` on local
> PostgreSQL copy, three runs clean. `php artisan test --filter=User`:
> 31 passed. Backfill ran locally over 200k synthetic rows; query count per
> batch is 1.
> Not run against production. Releases 2 and 3 are drafted on branches
> `users-full-name-r2` and `-r3` and must not be merged until the previous
> release is on all instances and the backfill reports zero remaining. The
> `NOT NULL` step uses `NOT VALID` + `VALIDATE` to avoid a full-table lock.
> Please confirm the production deploy for release 1.

## Why it matters

The single-migration version is correct on a laptop and wrong in production:
it breaks running instances for the length of the rollout, holds an exclusive
lock on the largest table while doing so, leaves the new column unconstrained,
and touches production without being asked. None of that shows up in a test
suite. The skill version is more work and three releases instead of one, but
each step can be deployed, observed and reversed on its own, the data
invariant lives in the database where every code path has to respect it, and
the human decides when production is touched. The report also makes the
remaining risk visible: two releases are still pending, and the order in which
they land matters.
