---
name: database
description: >-
  Guides relational database work in application code: schema design with
  constraints in the database, indexes that match real query patterns, efficient
  queries, short transactions, ORM usage that avoids N+1, and migrations that
  stay compatible with the code currently running (expand/contract, batched
  backfills, tested rollbacks, no production data changes without
  authorization). Use when writing or reviewing a migration, changing a schema
  or table, adding an index or foreign key, optimising a slow query, using an
  ORM or query builder, diagnosing N+1 queries, or wrapping work in a
  transaction.
license: MIT
metadata:
  collection: agentic-devcraft
  version: "0.1.0"
---

# Database

## Purpose

Database mistakes are the ones that survive a green test suite: a migration
that renames a column and breaks the old code still serving traffic, a
`NOT NULL` added in one statement that locks a large table, a loop that issues
one query per row, a constraint enforced only in a validator that one code path
skips. This skill makes the agent treat the database as a shared, stateful
system with running clients, and makes integrity, lock behaviour and query
count explicit decisions rather than side effects.

## When to use

- Writing or reviewing a migration, including ORM-generated ones.
- Adding or changing a table, column, type, index, foreign key or constraint.
- Writing queries through an ORM, a query builder or raw SQL.
- A slow endpoint or job where the database is a plausible cause.
- Wrapping multiple statements in a transaction, or deciding whether to.
- Any task that touches production data, directly or through a migration.

Rules are database-agnostic; concrete examples use PostgreSQL or MySQL and say
which. For document stores the integrity, migration and N+1 rules still apply;
the indexing and transaction details differ.

## Rules

Levels: **MUST** (no deviation without a documented exception), **SHOULD**
(deviate with a one-sentence reason), **CONSIDER** (judgment call).

### MUST

- **Keep every migration compatible with the code currently running.**
  Prevents: errors during the deploy window when old code reads a column that was renamed or dropped, or new code reads one that does not exist yet.
  Applies: every schema change in a system with rolling deploys, multiple instances, or any gap between migrate and release. Use expand/contract: add the new shape, dual-write, backfill, switch readers, then remove the old shape in a later release. Never drop or rename a column in the same release that stops using it.
  Exception: a single-instance app with a documented maintenance window, stated in the report.
  Verify: old code runs against the migrated schema, and new code runs against the pre-migration schema, for each step. See [references/safe-migrations.md](references/safe-migrations.md).

- **Treat changes on large tables as lock events and split them.**
  Prevents: table-wide locks or full rewrites that stall production for the duration of a backfill or index build.
  Applies: adding `NOT NULL`, adding a column with a volatile default, changing a type, building an index, or updating many rows on a table too large to rewrite within the lock budget. Add `NOT NULL` in steps (nullable column, batched backfill, then the constraint; in PostgreSQL via `ADD CONSTRAINT ... NOT VALID` then `VALIDATE`). Backfill in bounded batches with a sleep. Build indexes concurrently where supported (`CREATE INDEX CONCURRENTLY` in PostgreSQL, `ALGORITHM=INPLACE, LOCK=NONE` in MySQL).
  Exception: tables known to be small, with the row count stated in the report.
  Verify: the migration plan names each step, its lock level, and the row count it operates on.

- **Give every migration a tested rollback, or a written reason it cannot have one.**
  Prevents: being unable to revert a release because the schema cannot go back.
  Applies: every migration. Migrations migrate data; they do not delete it. A `down` that drops a column that was backfilled from another is a data-loss path and must say so.
  Exception: irreversible operations (dropping a column after the contract step) with the reason in the migration file and in the report.
  Verify: `up` then `down` then `up` was run against a non-production copy, or the reason for no `down` is in the file.

- **Never run migrations or data changes against production data without explicit authorization, and back up before anything destructive.**
  Prevents: unrecoverable loss from a migration, seed, `UPDATE` or `DELETE` that was meant for development.
  Applies: any environment holding real data, including "dev" boxes that are used as production. Destructive means drop, truncate, type narrowing, mass update or delete.
  Exception: none. Authorization is a message from the user naming the environment, not a general "deploy it".
  Verify: the report quotes the authorization and names the backup location and command.

- **Enforce integrity in the database, not only in application code.**
  Prevents: orphaned rows, duplicates and invalid states introduced by a second code path, a script, a race, or a direct SQL fix.
  Applies: `NOT NULL`, foreign keys with an explicit `ON DELETE` action, `UNIQUE` on anything the code assumes is unique (including composite keys), `CHECK` for closed value sets and ranges.
  Exception: a constraint the engine cannot express (cross-table invariants), enforced in a transaction and noted; or a legacy table where the data already violates it, with a cleanup plan.
  Verify: for each rule the code assumes, a constraint exists in the schema or the exception is written down.

- **Parameterise every query; never interpolate values into SQL.**
  Prevents: SQL injection and type-coercion bugs.
  Applies: raw SQL, query builders, ORM `whereRaw`-style escape hatches, and dynamic `IN (...)` lists.
  Exception: identifiers (table or column names) chosen from a fixed allow-list in code, never from input.
  Verify: no string concatenation or template literal builds SQL from runtime values.

- **Keep transactions short and free of external I/O.**
  Prevents: locks held across an HTTP call, a queue publish or a sleep, which turn one slow dependency into a database-wide stall and deadlocks.
  Applies: every explicit transaction and every ORM unit-of-work that opens one implicitly.
  Exception: none for I/O. Long-running data jobs run as a sequence of small transactions, not one.
  Verify: the transaction body contains only database statements and in-memory work; external calls happen before `BEGIN` or after `COMMIT`.

### SHOULD

- **Index for the queries that exist, verify with EXPLAIN, and count the write cost.**
  Prevents: unused indexes that slow every `INSERT` and `UPDATE`, and queries that scan because the index does not match the predicate.
  Applies: every new index and every query the task says is slow. Composite index column order: equality predicates first, then the range or sort column; the leftmost prefix is what other queries can reuse.
  Exception: small lookup tables where a scan is cheaper than the index.
  Verify: `EXPLAIN` (PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)`, MySQL `EXPLAIN` or `EXPLAIN ANALYZE`) shows the index used; the report names the query it serves. See [references/indexing-and-explain.md](references/indexing-and-explain.md).

- **Select the columns you need, keep indexed columns bare in predicates, and use keyset pagination for large sets.**
  Prevents: transferring blobs nobody reads, functions on indexed columns (`WHERE lower(email) = ?`, `WHERE date(created_at) = ?`) that defeat the index, and `OFFSET 100000` scans.
  Applies: list endpoints, exports, background jobs, and any query over a table expected to grow.
  Exception: `SELECT *` in ad-hoc debugging; `OFFSET` for small, bounded admin pages.
  Verify: the query lists columns, predicates compare the column directly (or an expression index exists), and pagination uses `WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT ?`.

- **Load associations eagerly or in batches; never query inside a loop over rows.**
  Prevents: N+1: one query per row, invisible in tests with three fixtures and fatal with ten thousand rows.
  Applies: any loop that touches a relation (`order.customer`, `post.tags`) and any template rendering a collection.
  Exception: a loop bounded by a small constant with the bound stated.
  Verify: the query log for the request or job shows a constant number of queries independent of row count; where the project has query-count assertions (Django `assertNumQueries`, Laravel `expectsDatabaseQueryCount`, Rails `assert_queries`), add one.

- **Draw transaction boundaries around multi-statement invariants and make retries idempotent.**
  Prevents: partial writes (order saved, stock not decremented) and double-apply on retry.
  Applies: any sequence of statements that must all succeed or none, and any code that retries on deadlock or serialization failure.
  Exception: a single statement already atomic by itself.
  Verify: the boundary covers every statement of the invariant; the default isolation level of the engine is known (MySQL InnoDB `REPEATABLE READ`, PostgreSQL `READ COMMITTED`) and the code does not assume stronger guarantees than it provides; retries re-read state rather than replaying stale values.

- **Match the existing schema's naming, types and conventions.**
  Prevents: `userId` next to `user_id`, `created_at` as `DATETIME` in one table and `TIMESTAMP` in another, money in `FLOAT`.
  Applies: every new table, column, index and constraint name.
  Exception: the task is a documented convention change.
  Verify: the new definition reads like its neighbours; money uses `DECIMAL`/`NUMERIC`, time uses the type the schema already uses, identifiers use the project's key type.

- **Normalise by default; denormalise with a stated read pattern and an owner for keeping it in sync.**
  Prevents: duplicated facts that drift (a `customer_name` on orders that no longer matches the customer) and, in the other direction, joins across six tables for one screen.
  Applies: new tables and any added column that copies data from another table.
  Exception: append-only snapshots that are supposed to freeze values (price at time of order).
  Verify: each denormalised column names the query it serves and the code path that updates it.

### CONSIDER

- **A covering index** (`INCLUDE` in PostgreSQL, extra trailing columns in MySQL) when a hot query reads only a few columns and the plan shows a heap or row lookup after the index scan.
- **Dropping to SQL when the ORM fights you** (window functions, upserts, `UPDATE ... FROM`, recursive CTEs); keep it parameterised, place it where the project keeps raw queries, and say so in the report.
- **Partial or filtered indexes** (`WHERE deleted_at IS NULL`, `WHERE status = 'pending'`) when most rows never match the hot predicate.
- **Turning on query logging in development** or a per-request query counter so N+1 is visible before review.

## Workflow

- **Understand:** read the schema the way it is, not the way the models describe it (`\d table` in psql, `SHOW CREATE TABLE` in MySQL): existing indexes, constraints, row counts (`pg_class.reltuples`, `information_schema.TABLES.TABLE_ROWS`), and how the project runs migrations and deploys (rolling, blue/green, maintenance window). Find out which environment the task targets and whether it holds real data.
- **Plan:** write the migration as ordered steps with the lock each one takes and which releases the old and new code paths span. For queries, write the predicate and sort you need, then the index that serves them. State what will be backed up and what authorization a production step needs.
- **Implement:** one concern per migration file; forward and backward steps; batched backfills as a separate, resumable command rather than inside a schema migration. Queries go through the project's query builder with eager loading declared at the call site.
- **Verify:** run `up`/`down`/`up` on a copy; `EXPLAIN` the changed queries; count queries for the changed request or job; run the project's tests. If no copy of a large table exists, say the lock behaviour is reasoned, not measured.
- **Report:** steps, locks, row counts, rollback path, backup location, the EXPLAIN result (plan shape, not adjectives), query count before and after, and any production step still awaiting authorization.

## Examples

**N+1 in Laravel Eloquent (MySQL).** Before: one query for orders, then one per order for the customer.

```php
$orders = Order::where('status', 'open')->get();
foreach ($orders as $order) {
    $lines[] = $order->customer->name . ': ' . $order->total;
}
```

After: two queries regardless of row count, and a test that pins it.

```php
$orders = Order::with('customer:id,name')->where('status', 'open')->get();

// tests/Feature/OpenOrdersTest.php
$this->expectsDatabaseQueryCount(2);
$this->get('/orders/open')->assertOk();
```

**Unsafe vs safe column rename (PostgreSQL), old code still deployed.**

Unsafe, one release:

```sql
ALTER TABLE users RENAME COLUMN fullname TO full_name;  -- old code now fails on every read
```

Safe, three releases. Release 1 expands and dual-writes; release 2 switches readers; release 3 contracts:

```sql
-- Release 1 migration
ALTER TABLE users ADD COLUMN full_name text;
-- app writes both columns; batched backfill job copies fullname -> full_name
-- Release 2: app reads full_name, still writes both
-- Release 3 migration, after release 2 is fully deployed
ALTER TABLE users DROP COLUMN fullname;
```

Report fragment: "Release 1 adds `full_name` (nullable, no lock beyond the
catalog update), dual-write in `User::save`, backfill command in batches of
5000 with `ORDER BY id`. Down drops `full_name`; it is non-destructive because
`fullname` remains the source until release 3. Not run against production:
awaiting authorization."

Full scenario: [examples/database/rename-column-expand-contract.md](../../examples/database/rename-column-expand-contract.md).

## Anti-patterns

- **Rename in place.** `RENAME COLUMN` or `DROP COLUMN` in the release that stops using it. Correction: expand/contract across releases; drop only after no deployed code references the old name.
- **Lazy loop.** Accessing a relation inside `for row in rows`. Correction: eager load at the query (`with`, `select_related`/`prefetch_related`, `includes`, `JOIN FETCH`) or batch by ids.
- **Index everything.** An index per column "to be safe". Correction: one index per real predicate-and-sort pattern; drop indexes `pg_stat_user_indexes` or `sys.schema_unused_indexes` show as unused.
- **Transaction around an HTTP call.** Charging a card or calling a webhook inside `BEGIN ... COMMIT`. Correction: commit the intent, call the service, record the outcome in a second transaction; reconcile failures.
- **Integrity in app code only.** Uniqueness checked with `SELECT` then `INSERT`. Correction: `UNIQUE` constraint plus handling the constraint violation; two concurrent requests pass the `SELECT`.
- **Backfill in one statement.** `UPDATE users SET full_name = fullname` on a large table. Correction: batches by primary key range, committed individually, resumable, throttled.
- **Offset to page ten thousand.** `LIMIT 50 OFFSET 500000` on an endpoint. Correction: keyset pagination on an indexed `(sort column, id)` pair.
- **Whole table in memory.** `Model.all()` then filtering in the language. Correction: filter and aggregate in SQL; stream or chunk (`cursor()`, `iterator()`, `find_each`) when the result must be large.

## Verification checklist

- [ ] Each migration step is compatible with both the old and the new code, and the release that drops or renames is a later one.
- [ ] Large-table steps name their lock level and row count; backfills are batched; indexes are built concurrently where the engine supports it.
- [ ] `up`/`down`/`up` ran on a non-production copy, or the file documents why there is no `down`.
- [ ] No production migration or data change ran without quoted authorization; backup command and location are in the report.
- [ ] Constraints (`NOT NULL`, FK, `UNIQUE`, `CHECK`) exist for every invariant the code assumes.
- [ ] Every query is parameterised; no SQL built from runtime strings.
- [ ] Transactions contain no external I/O and cover the whole invariant.
- [ ] `EXPLAIN` output for changed or new queries was observed and shows the intended index.
- [ ] Query count for the changed request or job is constant in row count; a count assertion exists where the project has the tooling.
- [ ] New names and types match the existing schema.

## Output

The report lists each migration step with its lock behaviour, the rollback
path or the reason there is none, the backup taken, and whether any step still
awaits production authorization. For query work it gives the query count
before and after and the plan shape from `EXPLAIN`, not a verdict like
"faster". It must not claim that a migration was tested, a plan was observed
or a backup exists unless the command was run and its result seen, and it must
never present a production data change as part of a routine deploy.
