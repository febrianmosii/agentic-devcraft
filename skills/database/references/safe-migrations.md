# Safe migrations: expand/contract recipes

Every recipe assumes the common failure case: migrations run before the new
code is fully deployed, and old and new code share the database for minutes
to days. Each step must work with both. "Release" below means one deploy that
contains the migration and the code change listed for it; the next release
starts only after the previous one is on every instance.

Syntax is PostgreSQL unless marked MySQL. Row counts are the deciding factor
for whether a step needs batching; look them up before planning, do not guess.

## Add a column

| Step | Schema | Code | Compatible with |
|---|---|---|---|
| 1 | `ALTER TABLE t ADD COLUMN c type NULL` (no volatile default) | none | old and new |
| 2 | none | write `c`; read with fallback | old (ignores `c`) and new |

A constant default (`DEFAULT 0`, `DEFAULT 'x'`) is a catalog change in
PostgreSQL 11+ and in MySQL 8 `INSTANT`; a volatile default (`now()`,
`gen_random_uuid()`) rewrites the table. Add the column without it, backfill,
then set the default.

## Rename a column

Never `RENAME COLUMN` while any deployed code uses the old name.

| Step | Schema | Code |
|---|---|---|
| 1 | add `new_name` nullable | write both `old_name` and `new_name` |
| 2 | batched backfill `new_name = old_name WHERE new_name IS NULL` | unchanged |
| 3 | none | read `new_name`, still write both |
| 4 | add `NOT NULL` / constraints to `new_name` (see below) | write `new_name` only |
| 5 | `DROP COLUMN old_name` | unchanged |

Steps 1-2 can ship in one release; 3, 4 and 5 are each a later release. If
the ORM caches column lists (some do), clear it on deploy or step 5 fails on
old instances.

A view or generated column can shortcut this when only reads need the new
name, but ORMs that write through the model usually cannot use it.

## Change a column type

Widening within the same family (`int` to `bigint`, `varchar(50)` to
`varchar(200)`, `text` to `text` with a check) is sometimes in place:

- PostgreSQL: `varchar(n)` to larger `n` or to `text` is catalog-only;
  `int` to `bigint` rewrites the table and takes `ACCESS EXCLUSIVE`.
- MySQL 8: `VARCHAR` widening within the same byte-length class is
  `INPLACE`; integer widening is a `COPY`.

When the change rewrites the table, use the rename recipe with the new type:
add `c_new`, dual-write with conversion, backfill, switch reads, drop `c`,
and only then rename `c_new` to `c` in a release where nothing references
`c_new` by that name (or keep the new name).

Narrowing (`text` to `varchar(20)`, `bigint` to `int`) is destructive: first
add a `CHECK` that proves no row violates the new bound, then convert.

## Add NOT NULL to an existing column

PostgreSQL:

```sql
-- 1. backfill in batches (see below) until no NULL remains
-- 2. constraint without a full-table lock
ALTER TABLE t ADD CONSTRAINT t_c_not_null CHECK (c IS NOT NULL) NOT VALID;
ALTER TABLE t VALIDATE CONSTRAINT t_c_not_null;   -- SHARE UPDATE EXCLUSIVE, scans without blocking writes
-- 3. PostgreSQL 12+: uses the validated CHECK to skip the scan
ALTER TABLE t ALTER COLUMN c SET NOT NULL;
ALTER TABLE t DROP CONSTRAINT t_c_not_null;
```

MySQL 8: `ALTER TABLE t MODIFY c type NOT NULL, ALGORITHM=INPLACE, LOCK=NONE`
after the backfill; if the server refuses `LOCK=NONE`, use an online schema
tool (gh-ost, pt-online-schema-change) rather than accepting the lock.

Code must stop writing `NULL` one release before the constraint lands.

## Batched backfill

Run as a resumable command, not inside the schema migration, so a failure
halfway does not roll back the schema or hold a transaction open.

```sql
-- repeat, advancing :last_id, until 0 rows affected
UPDATE t SET new_name = old_name
WHERE id > :last_id AND id <= :last_id + :batch AND new_name IS NULL;
```

- Order by primary key; keep `:batch` small enough that each statement
  commits in well under a second on the real table.
- Sleep between batches so replication and autovacuum keep up.
- Log the last id so the job can resume.
- Rows created after the backfill started are handled by the dual-write;
  run one final pass to catch any gap.

## Add an index on a large table

```sql
-- PostgreSQL: no table lock, cannot run inside a transaction
CREATE INDEX CONCURRENTLY t_c_idx ON t (c);
-- check for an INVALID index after a failed build
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
```

Most migration frameworks wrap each migration in a transaction; disable it
for this file (Rails `disable_ddl_transaction!`, Django `atomic = False`,
Laravel `$withinTransaction = false`, Flyway/Liquibase `runInTransaction`
false).

MySQL 8: `CREATE INDEX t_c_idx ON t (c) ALGORITHM=INPLACE, LOCK=NONE`.
Full-text and spatial indexes may not allow `LOCK=NONE`; check the error
and schedule those.

Drop with `DROP INDEX CONCURRENTLY` in PostgreSQL.

## Drop a column

| Step | Schema | Code |
|---|---|---|
| 1 | none | stop reading and writing the column; remove it from the model |
| 2 (next release) | `ALTER TABLE t DROP COLUMN c` | unchanged |

Some ORMs select every column by default; step 1 is incomplete until the
model no longer lists `c`, or old instances fail on `SELECT`. In PostgreSQL
the drop is catalog-only; in MySQL 8 it is `INPLACE` but still rebuilds.

Before step 2, confirm the column has no dependents: views, triggers,
generated columns, foreign keys, indexes.

## Rollback paths

| Step type | `down` | Note |
|---|---|---|
| add column | drop column | loses writes to the new column since `up`; acceptable while old column is still written |
| backfill | none needed | re-runnable; `down` is a no-op with a comment |
| add `NOT NULL` | drop constraint | safe |
| create index | drop index | safe; use `CONCURRENTLY` |
| drop column | recreate column | data is gone; the file must say so and the backup location must be in the report |
| type change via rename | drop the new column | safe until the old column is dropped |

A migration whose `down` would destroy data that `up` moved is acceptable
only with the destruction stated in the file and a backup taken before `up`.
