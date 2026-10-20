# The orders page is slow

**Skill:** performance
**Status:** Illustrative

Written by a maintainer to show the intended difference. Not a recorded
transcript; the environment, numbers and tool output below are part of the
illustration.

## Task

> The orders page (`GET /api/orders?status=open`, Laravel) takes almost two
> seconds for our bigger customers. Make it faster.

Existing shape: `OrderController@index` loads `Order::where('status',
$status)->get()` and passes the collection to `OrderResource`, which
outputs `customer.name`, `items[].sku` and `warehouse.code` for each
order. Large tenants have around 1,000 open orders. A seeder exists that
creates a tenant with 1,000 orders.

## Without the skill

The agent reads the controller, decides the database "is probably the
bottleneck", and wraps the whole response:

```php
public function index(Request $request)
{
    return Cache::remember('orders.open', 3600, function () use ($request) {
        return OrderResource::collection(
            Order::where('status', $request->status)->get()
        );
    });
}
```

It also replaces the `foreach` in a helper that formats totals with
`array_map` "for efficiency", and reorders the imports.

Report: "Added Redis caching to the orders endpoint, which makes it roughly
10x faster. Also optimized the totals loop."

What actually happened:

- No measurement was taken before or after. The "10x" is a guess.
- The key `orders.open` has no tenant, status or page in it, so the first
  tenant to load the page populates a cache that every other tenant then
  receives, and `status=shipped` returns the open orders.
- Nothing invalidates the entry; a newly created order is invisible for up
  to an hour.
- The first (uncached) request is exactly as slow as before, because the
  cause was never found.
- The totals helper and the import order were outside the request.

## With the skill

The agent first reproduces with realistic data and records a baseline:

```
php artisan db:seed --class=LargeTenantSeeder      # tenant 7, 1,000 open orders
hey -n 50 -c 1 "http://orders.test/api/orders?status=open" -H "Authorization: Bearer ..."
```

In the scenario's environment the baseline reads p50 1.61 s, p95 1.88 s
over 50 requests. With `DB::enableQueryLog()` wrapped around the
controller action, the query log holds 2,001 statements for one request:
one for the orders, then `SELECT * FROM customers WHERE id = ?` and
`SELECT * FROM order_items WHERE order_id = ?` once per order. The
warehouse is loaded once because the model already eager-loads it.

Plan, as written in the report before editing:

> Hotspot: N+1 in `OrderResource` (2,000 of 2,001 queries). Fix: eager-load
> `customer` and `items` on the controller query. Behaviour to preserve:
> same JSON shape, same ordering, no caching (the page must show a new
> order immediately). Target: query count constant in the number of orders;
> p95 well under the current 1.88 s.

The diff is three lines:

```diff
-        $orders = Order::where('status', $request->status)->get();
+        $orders = Order::where('status', $request->status)
+            ->with(['customer:id,name', 'items:id,order_id,sku'])
+            ->get();
```

Verification, same method, same seed, same box:

```
hey -n 50 -c 1 "http://orders.test/api/orders?status=open" -H "Authorization: Bearer ..."
php artisan test --filter=OrderIndexTest
```

In the scenario's environment the second run reads p50 0.11 s, p95 0.14 s
over 50 requests, and the query log holds 3 statements. `OrderIndexTest`
(6 tests, including a JSON snapshot of the response) passes unchanged. The
agent diffs the JSON body for tenant 7 before and after: identical.

Report:

> Baseline: `hey -n 50 -c 1 .../api/orders?status=open`, tenant 7 with 1,000
> open orders, local MySQL 8: p50 1.61 s, p95 1.88 s; 2,001 queries per
> request (query log).
> Cause: `OrderResource` reads `customer` and `items` per order with no
> eager load.
> Change: `->with(['customer:id,name', 'items:id,order_id,sku'])` in
> `OrderController@index` (3 lines).
> After, same command and seed: p50 0.11 s, p95 0.14 s; 3 queries per
> request. `php artisan test --filter=OrderIndexTest`: 6 passed. Response
> body byte-identical before and after.
> Behaviour changed: none. No cache added; the page must reflect new orders
> immediately.
> Noticed, not changed: `OrderResource` also formats `total` with
> `number_format` per row, about 4% of remaining time in the Xdebug
> profile; `orders.status` has no index, but `EXPLAIN` shows the filter is
> already cheap at this table size.

## Why it matters

Both agents say the page got faster. Only one of them knows. The first
version adds a shared cache with an incomplete key, which is a data leak
between tenants and a freshness bug, and leaves the real cause in place for
every cold request; its "10x" cannot be checked because nothing was
measured. The second version spends its first ten minutes on a baseline
and a query count, which point straight at the serializer, fixes the one
thing the evidence names, and proves the result with the same command it
started with. The report can be re-run by a reviewer and carries the
hotspots it chose not to touch.
