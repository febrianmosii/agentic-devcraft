# Indexing and reading EXPLAIN

An index is a bet that a specific predicate-and-sort pattern is worth paying
for on every write. Make the bet explicit: write the query first, design the
index for it, then prove with `EXPLAIN` that the planner takes it.

## Composite index column order

A B-tree composite index `(a, b, c)` is sorted by `a`, then `b` within equal
`a`, then `c`. The planner can use it for:

- equality on `a`;
- equality on `a` and `b`;
- equality on `a`, `b`, and a range or sort on `c`;
- equality on `a` and a range on `b` (then `c` is only a filter).

It cannot use it for a predicate on `b` alone or `c` alone, apart from a
full index scan.

Ordering rule:

1. Columns compared with `=` first, most selective among them first when
   several queries share the prefix.
2. Then the one column used with a range (`<`, `>`, `BETWEEN`, `LIKE 'x%'`)
   or in `ORDER BY`.
3. Anything after a range column only narrows rows after the index lookup;
   it does not reduce the scan.

Example: `WHERE tenant_id = ? AND status = ? AND created_at > ? ORDER BY created_at`
is served by `(tenant_id, status, created_at)`. The same index also serves
`WHERE tenant_id = ?` and `WHERE tenant_id = ? AND status = ?`, so check for
an existing index on a prefix before adding a new one.

`ORDER BY created_at DESC` with that index needs no separate sort in either
PostgreSQL or MySQL 8 (backward scan). A mixed-direction sort
(`ORDER BY a ASC, b DESC`) needs an index declared with matching directions.

## Covering indexes

When the plan shows the index scan followed by a table lookup for every row
(PostgreSQL "Heap Fetches" or a plain Index Scan where Index Only Scan was
hoped for; MySQL missing `Using index` in `Extra`), and the query reads few
columns, include them:

```sql
-- PostgreSQL: columns searchable in the key, payload in INCLUDE
CREATE INDEX orders_tenant_status_idx
  ON orders (tenant_id, status) INCLUDE (total, created_at);
-- MySQL: append the columns to the key
CREATE INDEX orders_tenant_status_idx
  ON orders (tenant_id, status, total, created_at);
```

In PostgreSQL an Index Only Scan still fetches heap pages for tuples not yet
marked all-visible; a table with heavy churn needs vacuum to keep the
visibility map current.

## Predicates that defeat an index

- A function on the column: `lower(email) = ?`, `date(created_at) = ?`,
  `created_at + interval '1 day' > ?`. Rewrite as a range on the bare column
  (`created_at >= ? AND created_at < ?`) or create an expression index on
  the same expression.
- Implicit casts: comparing a `varchar` column to an integer parameter, or a
  `bigint` to a `text` parameter. Match the parameter type to the column.
- Leading wildcard: `LIKE '%foo'`. Needs a trigram index (PostgreSQL
  `pg_trgm`) or full-text search.
- `OR` across different columns: often becomes a scan; a `UNION ALL` of two
  indexed queries or separate indexes with a bitmap OR (PostgreSQL) help.
- Low selectivity: an index on a boolean or a three-value status column is
  rarely used unless partial (`WHERE status = 'pending'`) or combined in a
  composite.

## Reading EXPLAIN in PostgreSQL

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ... ;
```

`ANALYZE` runs the query; wrap in `BEGIN; ... ROLLBACK;` for writes. Read the
tree from the innermost node outward. Node types to recognise:

| Node | Meaning | Reaction |
|---|---|---|
| `Seq Scan` on a large table with a `Filter:` | no usable index for the predicate | add or fix the index; or accept if most rows qualify |
| `Index Scan` | index locates rows, heap fetched per row | fine for selective predicates |
| `Index Only Scan` | answered from the index | ideal; watch `Heap Fetches` |
| `Bitmap Heap Scan` + `Bitmap Index Scan` | index yields many rows, fetched in page order | normal for medium selectivity |
| `Nested Loop` with an inner `Seq Scan` | one scan per outer row | index the join column |
| `Hash Join` / `Merge Join` | bulk joins | normal for large inputs |
| `Sort` with `Sort Method: external merge` | sort spilled to disk | index to provide order, or raise `work_mem` for the session |

Compare `rows=` estimated against `actual rows=`. A large mismatch means stale
statistics (`ANALYZE table`) or a predicate the planner cannot estimate; fix
that before adding indexes, because the plan will change once estimates are
right. `Buffers: shared read=` shows I/O; a plan that is fast on a warm cache
and slow in production usually has high `read` numbers.

Unused index check:

```sql
SELECT indexrelid::regclass, idx_scan FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelid NOT IN (SELECT conindid FROM pg_constraint);
```

## Reading EXPLAIN in MySQL 8

```sql
EXPLAIN SELECT ... ;            -- estimated plan, tabular
EXPLAIN ANALYZE SELECT ... ;    -- executes, tree with actual timings
EXPLAIN FORMAT=JSON SELECT ...; -- includes cost and used key parts
```

Tabular columns that matter:

| Column | Watch for |
|---|---|
| `type` | `ALL` = full scan; `index` = full index scan; `range`, `ref`, `eq_ref`, `const` are progressively better |
| `key` / `key_len` | which index and how many bytes of the composite key are used; short `key_len` means only a prefix matched |
| `rows` | estimated rows examined per step; multiply across joined tables |
| `Extra` | `Using filesort` (sort not from index), `Using temporary` (materialised intermediate), `Using index` (covering), `Using index condition` (ICP; fine) |

`EXPLAIN ANALYZE` output lists `actual time=.. rows=.. loops=..` per node;
a node with high `loops` inside a nested loop join is the N+1 of the
planner and points at a missing index on the inner table.

Unused index check (requires `sys` schema, counters reset on restart):

```sql
SELECT * FROM sys.schema_unused_indexes;
```

## Write cost

Every index on a table is maintained on each `INSERT`, on each `DELETE`, and
on each `UPDATE` that touches an indexed column (PostgreSQL may avoid it with
HOT updates when no indexed column changes and the page has room). Before
adding an index to a write-heavy table, list its existing indexes and remove
those with no scans. One composite index serving three queries beats three
single-column indexes that serve one each.

## What to put in the report

The plan node that changed (for example "Seq Scan with Filter on `status`
became Index Scan using `orders_tenant_status_idx`"), the estimated and actual
row counts, and the environment the plan came from. A plan from a development
database with a hundred rows is evidence that the index is eligible, not that
production will use it; say which.
