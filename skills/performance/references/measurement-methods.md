# Measurement methods by layer

Pick the method that matches the layer the complaint lives in, record the
exact command, run it enough times to see the spread, and run the identical
command after the change. Commands below are starting points; prefer the
project's own tooling when it exists.

## Ground rules for every layer

- Same input, same environment, same command before and after. A change of
  machine, dataset size or cache state between runs invalidates the pair.
- Warm up once, then take 5 or more runs. Report the median and the
  min-max range, not a single value.
- State the input size ("1,000 open orders", "the 48 MB export"). Measure on
  production-like sizes; fixtures with three rows hide every real problem.
- Record the baseline in the report before touching code.

## Backend: where does the time go?

Wall-clock first, then profile only the slow path.

```bash
# Repeated HTTP timing, single concurrency, p50/p95 in the summary
hey -n 50 -c 1 "http://localhost:8000/api/orders?status=open"
# or, without extra tools
for i in $(seq 1 10); do curl -s -o /dev/null -w "%{time_total}\n" "http://localhost:8000/api/orders"; done
```

Profilers:

- Python: `python -X importtime` for startup; `python -m cProfile -o out.prof app.py` then `snakeviz out.prof`; `py-spy record -o profile.svg --pid <pid>` for a live process.
- Node: `node --cpu-prof script.js` (open the `.cpuprofile` in Chrome DevTools, Performance tab); `clinic flame -- node server.js`.
- PHP: Xdebug profiler (`xdebug.mode=profile`) viewed in KCachegrind/qcachegrind; `Blackfire` or `SPX` where installed; Laravel Telescope or Debugbar for per-request query and timing lists.
- Go: `go test -bench . -benchmem -count 5`; `go tool pprof` on a `/debug/pprof/profile` endpoint.
- Ruby: `stackprof`, `rack-mini-profiler`.
- JVM: async-profiler, JFR (`-XX:StartFlightRecording`).

Read the profile top-down by inclusive time. The first function that is not
framework glue is the candidate.

## Database: is it the query or the count?

Count queries per request before anything else; an N+1 shows up as a
number that scales with rows.

- Laravel: `DB::enableQueryLog()` then `count(DB::getQueryLog())`; Telescope's Queries tab.
- Django: `len(connection.queries)` with `DEBUG=True`; `django-debug-toolbar`; `assertNumQueries(n)` in tests.
- Rails: the `bullet` gem; `ActiveRecord::Base.logger`.
- Any driver: general query log or `log_min_duration_statement` in PostgreSQL.

Then explain the slow statement with real parameters:

```sql
-- PostgreSQL: real execution, buffers, timing
EXPLAIN (ANALYZE, BUFFERS) SELECT ... ;
-- MySQL 8+: estimated plan, or actual with ANALYZE
EXPLAIN FORMAT=TREE SELECT ... ;
EXPLAIN ANALYZE SELECT ... ;
```

What to look for: `Seq Scan` / `type: ALL` on a large table, `rows`
examined far above rows returned, `Using filesort` / `Using temporary`,
nested loops with a large outer side. Quote the before and after plans in
the report. Index choice and schema changes go through the `database` skill.

## HTTP and services: where is the wait?

- `curl -w "@curl-format.txt"` with `time_namelookup`, `time_connect`, `time_starttransfer`, `time_total` separates DNS, TLS, server and transfer time.
- Distributed traces (OpenTelemetry, Jaeger, Datadog APM) show which downstream call dominates a request.
- Load, not latency: `k6 run script.js`, `wrk -t4 -c50 -d30s URL`, `locust`. Run against a staging-like box; a laptop with a cold cache measures the laptop.

Every outbound call in the code under test needs a timeout. If one is
missing, the measurement is of the downstream service's mood, not your code.

## Frontend: Core Web Vitals and bytes

- Lighthouse, same profile every run:
  `lighthouse https://example.test/orders --preset=desktop --output=json --output-path=./lh-before.json`
  (or the default mobile preset with simulated throttling). Run 3 or more
  times and take the median LCP, INP (or TBT in lab runs), CLS.
- Bundle size: read the build output (`vite build`, `next build`,
  `webpack --json | npx webpack-bundle-analyzer`) and quote bytes, gzip or
  brotli as the server actually serves them.
- Chrome DevTools: Performance panel for long tasks and layout thrash
  (repeated forced reflow warnings); Network panel with throttling for
  render-blocking requests; Coverage tab for unused JS and CSS.
- Field data, when available: the Chrome UX Report or your RUM tool. Lab
  numbers are for before/after comparison; field numbers tell you whether
  users noticed.

## Memory: does it grow without bound?

Measure growth, not a single reading.

- Node: `node --inspect`, take a heap snapshot in DevTools, perform the
  operation 20 times, take another, compare retained size by constructor;
  `process.memoryUsage().heapUsed` logged per iteration for a quick check.
- Python: `tracemalloc` (`tracemalloc.start()`, snapshot before and after,
  `compare_to(..., "lineno")`); `memray run` for allocation flame graphs.
- PHP: `memory_get_peak_usage(true)` around the operation; for workers,
  watch RSS over time with `ps -o rss= -p <pid>`.
- Go: `go tool pprof -sample_index=inuse_space` on `/debug/pprof/heap`.
- Any process: `ps`, `top` or `/proc/<pid>/status` sampled every minute
  while the workload repeats; a monotonic climb is a leak, a sawtooth is
  the collector working.

Typical culprits: listeners added on every render and never removed,
caches keyed by something unbounded (URL with query string, user id with
no eviction), timers never cleared, connections opened per call and never
closed, whole files read into memory.

## Writing the numbers down

Minimum for the report, before and after:

```
Method:  hey -n 50 -c 1 http://localhost:8000/api/orders?status=open
Input:   1,000 open orders, local MySQL 8, PHP 8.3, seeded via OrderSeeder
Before:  p50 1.62 s, p95 1.84 s (50 req); 201 queries/request
After:   p50 0.08 s, p95 0.10 s (50 req); 3 queries/request
```

These lines are a template. Fill them from output you saw; if a cell cannot
be filled, write "not measured" in it rather than an estimate.
