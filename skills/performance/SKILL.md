---
name: performance
description: >-
  Makes performance work evidence-based: measures before and after with the
  same method, optimizes only what the profile or EXPLAIN names, fixes N+1
  queries, quadratic loops, oversized bundles and unbounded memory, and adds
  caches only with a key and an invalidation strategy. Use when something is
  "slow", when asked to "optimize" or reduce "latency", when a request hits a
  "timeout", when hunting a "memory leak" or an "N+1" query, or when Core Web
  Vitals (LCP, INP, CLS) must improve.
license: MIT
metadata:
  collection: agentic-devcraft
  version: "0.1.0"
---

# Performance

## Purpose

Asked to make something faster, agents guess: they cache the first function
they see, rewrite a loop that runs twelve times, and report "significantly
faster" with no number behind it. The guess is usually wrong, the cache
serves stale data, and the report cannot be checked. This skill makes every
optimization start from a measurement, end with the same measurement, leave
observable behaviour untouched unless the user accepted a change, and report
only numbers that were observed.

## When to use

- A user reports slowness: a page, an endpoint, a job, a query, a build.
- The request contains *optimize*, *latency*, *timeout*, *memory leak*,
  *N+1*, *throughput*, *bundle size*, *Core Web Vitals*, *LCP*, *INP*, *CLS*.
- A test, worker or deploy fails on a time or memory limit.
- Reviewing a change that adds a cache, a parallel branch or a new data
  structure "for performance".
- Writing code over inputs with no fixed size: database result sets,
  uploads, exports, event streams.

Not for schema design or migration mechanics; that is the `database` skill.
Not for code that runs rarely on small inputs where nobody has measured a
problem.

## Rules

Levels: **MUST** (no deviation without a documented exception), **SHOULD**
(deviate with a one-sentence reason), **CONSIDER** (judgment call).

### MUST

- **Measure before changing anything, and measure after with the same method.**
  Prevents: optimizing an imagined bottleneck; "faster" claims that are noise.
  Applies: every change made for performance reasons.
  Exception: none. If nothing can be measured, the change is not a performance change and the report says so.
  Verify: the report shows the command or tool, the before number, the after number and the repetition count; both runs used the same inputs and environment.

- **Optimize what the measurement names, not what looks slow.**
  Prevents: premature optimization; rewriting a loop that accounts for 1% of the time.
  Applies: choosing what to change after profiling.
  Exception: a defect that is pathological on its face (a query inside a loop over thousands of rows, unbounded recursion) may be fixed first, then measured.
  Verify: the profile, EXPLAIN or trace that pointed at the changed code is quoted in the report.

- **Do not change observable behaviour unless the task says so.**
  Prevents: optimizations that silently drop ordering, change rounding, skip validation or return stale data.
  Applies: every performance change, above all caching, batching, parallelization and algorithm swaps.
  Exception: the user explicitly accepts a stated change (for example "stale by up to 60 s is fine").
  Verify: existing tests pass unchanged; outputs before and after are diffed on a representative input; any accepted change is written in the report.

- **Every cache has a key covering everything the value depends on, and an invalidation or expiry strategy.**
  Prevents: stale data after a write; one user's data served to another from a shared cache.
  Applies: any in-process, distributed or HTTP cache you add or touch.
  Exception: immutable data (content-addressed assets, closed historical records).
  Verify: the key includes user, tenant, locale, role and version wherever the value varies by them; the report names what invalidates the entry and the TTL; a test writes, then reads, and sees the new value.

- **Never load an unbounded result set or file into memory to process it.**
  Prevents: out-of-memory crashes and timeouts that appear only at production data sizes.
  Applies: queries without a limit, `SELECT *` into ORM collections, file reads, HTTP response bodies, message batches.
  Exception: a size bound exists and is enforced upstream, and the report names it.
  Verify: the code paginates, streams or chunks, or the report states the enforced bound.

- **Keep work linear over inputs that can be large.**
  Prevents: code that passes with 10 fixture rows and times out with 10,000.
  Applies: nested loops, `includes`/`in` on a list inside a loop, repeated string concatenation, sorting or querying inside a loop.
  Exception: the input is bounded by design (enum sizes, configuration lists) and the bound is stated.
  Verify: inner lookups use a set or map; the report states the realistic upper size of the input.

- **Report measurements as real (command plus numbers) or label them "not measured".**
  Prevents: speedup by assertion; estimates that read as measurements.
  Applies: every performance claim in a report, PR description or commit message.
  Exception: none.
  Verify: each number traces to a command that was run and output that was observed; estimates are written as "expected, not measured".

### SHOULD

- **Fix N+1 queries at the source: eager-load, batch or join.**
  Prevents: one query per row, which scales with the result and dominates endpoint time.
  Applies: ORM relations accessed in loops, serializers, template loops, GraphQL resolvers.
  Exception: the loop is bounded to a handful of rows by design.
  Verify: the query count for one request is logged before and after (Laravel `DB::enableQueryLog()`, Django `connection.queries`, Rails `bullet`, driver SQL logging) and no longer grows with the row count.

- **Select only the columns and rows the caller needs, and add the index the plan asks for.**
  Prevents: full scans, wide rows crossing the wire, sorts spilling to disk.
  Applies: any query that appears in the profile.
  Exception: small tables where `EXPLAIN` already shows a scan as the cheapest plan.
  Verify: `EXPLAIN` (or `EXPLAIN ANALYZE`) before and after is in the report and rows examined drop. Index and schema design beyond the hot query belong to the `database` skill.

- **Parallelize independent I/O with a concurrency bound and a timeout; keep CPU-bound work sequential unless profiled.**
  Prevents: serial waits on unrelated remote calls; also thread pools added to CPU work that only add contention.
  Applies: multiple remote calls, file reads or queries that do not depend on each other's results.
  Exception: the downstream service has a rate or connection limit that parallel calls would breach.
  Verify: `Promise.all`, `asyncio.gather` or a worker group with a stated limit; every outbound call has a timeout; the connection pool size is stated and not exceeded by the fan-out.

- **Treat Core Web Vitals and bundle size as measurable targets.**
  Prevents: "optimized the frontend" with no before/after on LCP, INP, CLS or bytes shipped.
  Applies: any change motivated by page speed: lazy loading, image sizing, code splitting, render-blocking resources, layout thrash.
  Exception: none.
  Verify: Lighthouse or WebPageTest run with the same device profile and throttling, 3 or more runs, median reported; bundle size quoted in bytes from the build output.

- **Release what you acquire; bound what you accumulate.**
  Prevents: leaks from listeners never removed, intervals never cleared, connections not returned, maps that only grow.
  Applies: event subscriptions, timers, file handles, database connections, in-process caches, queues.
  Exception: process-lifetime singletons created once at startup.
  Verify: every subscribe, `setInterval` or open has a matching removal on the unmount or close path; every in-process cache has a maximum size or TTL; heap does not grow across repeated runs of the operation.

### CONSIDER

- **Lazy-loading routes, components and below-the-fold images** when the bundle or LCP measurement shows the initial payload is the bottleneck; give images `width`, `height` and `srcset` so they do not shift layout.
- **A request-scoped memo instead of a shared cache** when the same value is read many times inside one request; it needs no invalidation.
- **A load test (k6, wrk, locust) in a staging-like environment** before claiming a throughput gain; single-request timing hides contention on pools and locks.
- **A "measured, not changed" note** for hotspots the profile exposed outside the task, so the next person starts from data.

Measurement procedures per layer: [references/measurement-methods.md](references/measurement-methods.md).
Choosing what to cache and how to invalidate it: [references/caching-decisions.md](references/caching-decisions.md).

## Workflow

- **Understand:** reproduce the slowness with a repeatable command on data of realistic size (production-like row counts, not three fixture rows). Record the baseline: number, method, repetitions, environment. Find the project's own profiling and timing tools before adding any.
- **Plan:** read the profile, `EXPLAIN` or trace and name the single largest contributor. Write down the behaviour that must survive (ordering, consistency, freshness, error handling). Set the target ("p95 under 300 ms", "LCP under 2.5 s on throttled mobile") so you know when to stop.
- **Implement:** make the one change the measurement supports. Do not bundle a cache, an index and a refactor in one diff; land them separately so each can be measured and reverted alone.
- **Verify:** rerun the identical measurement. Run the existing tests. For a cache, test write-then-read. For memory, repeat the operation and compare heap snapshots. If the number did not move beyond the run-to-run spread, revert and say so.
- **Report:** baseline and result (command, numbers, repetitions), the evidence that named the hotspot, the change, behaviour preserved or accepted as changed, and hotspots noticed but left alone.

## Examples

**Request:** "The `/api/orders` endpoint is slow."

Before: the serializer issues one query per order for the customer and one
for the items.

```python
def serialize_orders(orders):
    return [
        {
            "id": o.id,
            "customer": o.customer.name,              # query per order
            "items": [i.sku for i in o.items.all()],  # query per order
        }
        for o in orders
    ]

orders = Order.objects.filter(status="open")
```

After: load the relations with the parent query; the serializer is unchanged.

```python
orders = (
    Order.objects.filter(status="open")
    .select_related("customer")
    .prefetch_related("items")
    .only("id", "status", "customer__name")
)
```

How the gain is measured: count queries per request before and after
(`django-debug-toolbar` or `django.db.backends` logging at DEBUG) and time the
endpoint with `hey -n 50 -c 1 "http://localhost:8000/api/orders?status=open"`,
comparing p50 and p95. The expected shape is "2N+1 queries become 3"; the
wall-clock change is whatever the second run shows. A report line might read
"before: 201 queries, p95 1840 ms; after: 3 queries, p95 95 ms; 50 requests
each". Those are hypothetical values to show the format, not measurements of
any system.

**Request:** "Flag import rows whose tag already exists."

```js
// quadratic: rows.length × existing.length comparisons
const dupes = rows.filter((r) => existing.some((e) => e.tag === r.tag));
```

```js
const seen = new Set(existing.map((e) => e.tag));
const dupes = rows.filter((r) => seen.has(r.tag));
```

Measure on the largest real import (ask how many rows it has), five runs
with `console.time` or `node --cpu-prof`, and report the median of each.

Full scenario: [examples/performance/slow-orders-page.md](../../examples/performance/slow-orders-page.md).

## Anti-patterns

- **Optimizing the wrong loop.** Rewriting code that reads as slow while the profile puts 90% of the time in one query. Correction: profile first; change only the top contributor.
- **Speedup by assertion.** "This should be much faster now." Correction: run the same measurement before and after, put both numbers in the report, or write "not measured".
- **Cache without invalidation.** Wrapping a function in `@lru_cache` or `Cache::remember()` with no plan for writes. Correction: define the key, the TTL and the write path that invalidates; test write-then-read.
- **Shared cache, per-user data.** Caching `currentUser.dashboard()` under the key `dashboard`. Correction: put user, tenant, locale and role in the key, or do not cache.
- **Micro-benchmark theatre.** Timing a function on a 10-element array in isolation and extrapolating. Correction: measure the end-to-end path on realistic data; a micro-benchmark only confirms a hypothesis the profile already raised.
- **Buffering the whole file.** `readFile` or `file_get_contents` on an upload or export, then processing. Correction: stream (`createReadStream`, chunked `fopen` reads, cursor or `chunk()` queries) so peak memory is independent of input size.
- **Parallelism without limits.** `Promise.all` over 10,000 items against a third-party API. Correction: bound concurrency (`p-limit`, a semaphore, a worker pool), set timeouts, respect the downstream limit.
- **Single-run comparison.** One timing before, one after, 30% apart, declared a win. Correction: 5 or more runs each; report median and spread; a difference inside the spread is not a result.

## Verification checklist

- [ ] Baseline measured with a stated command, input size and repetition count before any change.
- [ ] The profile, `EXPLAIN` or trace that named the hotspot is quoted in the report.
- [ ] The same measurement was rerun after the change; both numbers are in the report.
- [ ] Existing tests pass; outputs are unchanged, or the accepted behaviour change is written down.
- [ ] Every new cache entry has a complete key, a TTL or invalidation path, and a write-then-read test.
- [ ] No unbounded collection, listener, timer or connection is left without a bound or a release path.
- [ ] Any number not observed is labelled "not measured" or "expected".

## Output

The report places baseline and result side by side, each with the command,
environment, input size and repetition count; quotes the evidence that
pointed at the changed code; describes the change; and states the behaviour
that was preserved or deliberately altered. It must not contain a speedup
figure that was not observed, must not present an estimate as a measurement,
and must not call anything "fast", "optimized" or "efficient" without the
number that backs the word.
