# Caching decisions

A cache trades freshness and memory for latency. Add one only when the
measurement shows the cached computation is the hotspot, and answer the
questions below in the report before writing the code.

## 1. Is a cache the right fix at all?

Before caching, check whether the expensive work can be removed instead:

- An N+1 is fixed by eager loading, not by caching each row.
- A missing index is fixed by the index.
- A value computed many times inside one request needs a request-scoped
  memo (a local variable, `WeakMap`, Laravel `once()`), which has no
  invalidation problem because it dies with the request.

Cache when the work is genuinely needed, genuinely repeated across
requests, and its inputs change less often than it is read.

## 2. What exactly is the key?

The key must include every input the value depends on. Enumerate them:

| Input the value varies by | Must be in the key |
|---|---|
| User, account, tenant | yes, or the cache leaks data between users |
| Locale, currency, timezone | yes, if the output is formatted |
| Role or permissions | yes, if the output is filtered by them |
| Query parameters, filters, page | yes |
| Schema or serializer version | yes, so a deploy does not serve old shapes |
| Feature flags that change output | yes |

Per-user or per-tenant data in a shared cache (Redis, Memcached, a
process-wide map, a CDN) without the user or tenant in the key is a data
exposure, not a performance bug. When in doubt, do not cache it.

Prefix keys with the app and a version (`app:v3:orders:list:tenant=42:page=2`)
so a whole family can be dropped by bumping the version.

## 3. How does a write invalidate it?

Pick one and write it in the report:

- **Write-through invalidation.** Every code path that changes the source
  deletes or rewrites the key. Works when writes are few and all go through
  one place (model events, a repository). Fails silently when a new write
  path is added later; add a test that writes then reads.
- **TTL only.** The entry expires after a fixed time; readers accept
  staleness up to that limit. Only valid when the user has agreed to the
  staleness window. State it as "stale by up to N seconds" in the report.
- **Version or tag.** Keys include a version number stored next to the
  source; a write bumps the version, old keys become unreachable and expire
  by TTL. Good for families of keys (all pages of one listing).
- **Event-driven.** A queue message or database trigger clears entries.
  Needed when the writer is another service; verify the message is actually
  consumed in the environment you measured in.

"We will clear it manually" is not a strategy.

## 4. What is the TTL?

Even with explicit invalidation, set a TTL as a safety net. Choose it from
the data's change rate and the cost of staleness, not from habit:

- Reference data that changes with deploys: hours, bumped by version.
- Listings and counts: tens of seconds to minutes, with invalidation on
  write.
- Anything with money, inventory or permissions in it: seconds, or no cache.

## 5. What happens when it expires under load?

A popular key expiring causes every concurrent request to recompute it (a
stampede). Mitigations, cheapest first:

- Lock-and-recompute: one request recomputes, others wait or serve the old
  value (`Cache::lock()` in Laravel, `singleflight` in Go, a Redis `SET NX`
  lock).
- Early refresh: recompute probabilistically before expiry
  (`Cache::flexible()` in Laravel, stale-while-revalidate on HTTP).
- Jittered TTLs so keys written together do not expire together.

If the recomputation is cheap, none of this is needed; say so.

## 6. Is it bounded?

An in-process cache with no maximum size is a memory leak with a nicer
name. Use an LRU with a size limit (`lru-cache`, `functools.lru_cache(maxsize=...)`,
Guava `maximumSize`), or a store with eviction (Redis `maxmemory-policy`).
Keys built from unbounded inputs (full URLs, free-text search terms) need a
tighter bound or should not be cached.

## 7. How is it verified?

- A test that writes to the source and then reads through the cache and
  sees the new value.
- A test or manual check that two users (or tenants) do not see each
  other's cached data.
- The same timing as the baseline, run again, with a warm cache and with a
  cold cache; report both. A cache that is cold on every request because
  the key includes a timestamp is a cost, not a gain.

## HTTP caching specifics

- `Cache-Control: private` for anything that depends on the session;
  `public` only for content identical for everyone.
- `ETag` or `Last-Modified` plus conditional requests avoid transfer without
  avoiding computation; measure whether the computation or the transfer was
  the problem.
- Immutable assets get a content hash in the filename and a long
  `max-age`; HTML and API responses do not.
- A CDN in front of an endpoint that varies by cookie needs `Vary` set
  correctly, or it is the shared-cache leak from section 2 at the edge.

## Report fragment

```
Cache added: orders listing, key app:v3:orders:list:tenant={id}:status={s}:page={n}
Invalidation: Order saved/deleted event bumps orders:version:tenant={id}; TTL 120 s as backstop
Staleness accepted: none beyond the write-to-event delay (same process, synchronous)
Bound: Redis, maxmemory-policy allkeys-lru (existing)
Verified: OrderCacheTest::test_write_then_read (passes); cold p95 ..., warm p95 ... (hey -n 50)
```
