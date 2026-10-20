# Is the CSV export ready to deploy on Friday?

**Skill:** production-readiness
**Status:** Illustrative

This scenario was written by a maintainer to show the behaviour the skill is
designed to produce. It is not a recorded transcript.

## Task

> The new "export orders to CSV" feature is on branch `feature/order-export`.
> Product wants it live Friday. Is it ready to deploy?

The branch contains a new `ExportService`, an admin route
`POST /admin/orders/export`, a background job that writes the file to object
storage, a new environment variable `EXPORT_BUCKET`, and a migration
`2026_10_16_000000_drop_orders_legacy_ref.php` that removes the
`orders.legacy_ref` column "because the export doesn't need it". The
project is a Laravel application deployed by a rolling symlink switch with
queue workers restarted a few minutes after the switch.

## Without the skill

The agent reads the branch, finds a tidy diff and a CI badge that was green
three commits ago, and answers:

> Yes, this is production ready. The code is clean and well-tested, the
> migration is included, configuration is handled via environment
> variables, and there are no security concerns. Safe to deploy Friday.

No command was run. The suite had a failing test introduced two commits
after the green badge (`ExportServiceTest::it_streams_large_files` fails
because the stream is buffered into memory). `EXPORT_BUCKET` is read as
`env('EXPORT_BUCKET', 'orders-export-dev')`, so a forgotten variable in
production writes exports to the development bucket. The migration drops
`orders.legacy_ref`, which `OrderController@show` in the currently deployed
release still selects; during the rolling switch, and until the queue
workers restart, every order page and every `SyncOrdersJob` fails with an
unknown-column error. The "no security concerns" claim covered an audit
that never ran.

## With the skill

The agent writes the check list first, marks the deploy pipeline as "symlink
switch, workers restart late", and runs what can run here:

```
composer install --no-interaction        # exit 0
php artisan test                         # 311 passed, 1 failed
                                         # FAIL ExportServiceTest::it_streams_large_files
                                         #   memory limit exceeded at 512 MB
composer audit                           # 0 advisories
vendor/bin/phpstan analyse --no-progress # 0 errors
git log --all --diff-filter=A --name-only -- '*.env*' '*.pem'   # (none)
grep -rn "EXPORT_BUCKET" app config .env.example
  config/export.php:7:  'bucket' => env('EXPORT_BUCKET', 'orders-export-dev'),
  .env.example: (no entry)
```

It then reads the migration and greps the base branch:

```
git grep -n "legacy_ref" origin/master -- app
  app/Http/Controllers/OrderController.php:48: ->select(['id','status','legacy_ref', ...
  app/Jobs/SyncOrdersJob.php:33: $order->legacy_ref
```

It does not run the migration anywhere shared. The report:

> **Verdict: not ready. Two blocking findings, one fix required before a
> Friday deploy is realistic.**
>
> Blocking:
> 1. `2026_10_16_000000_drop_orders_legacy_ref.php` drops a column that the
>    deployed release reads in `OrderController@show` and `SyncOrdersJob`.
>    With the symlink deploy and late worker restart, order pages and the
>    sync job fail between migration and switch, and the migration has no
>    `down` that restores data. Fix: remove the drop from this release;
>    ship the code change that stops reading `legacy_ref`, drop the column
>    in the next release. Not run; I did not touch any database.
> 2. `ExportServiceTest::it_streams_large_files` fails: `ExportService`
>    buffers the full result set before writing. At current volume
>    (about 40k orders per tenant from the fixture) this is 512 MB; at
>    10x it will not complete. Fix: use `cursor()` and write rows to the
>    stream as they arrive.
>
> Verified:
> - `composer install` → exit 0; `vendor/bin/phpstan analyse` → 0 errors.
> - `php artisan test` → 311 passed, 1 failed (above).
> - `composer audit` → 0 advisories.
> - No secret files added in history; no credential literals in the diff.
> - New route is behind the `admin` middleware group (`routes/admin.php:22`).
> - `ExportJob` has `$tries = 3`, `$backoff = [10, 60, 300]`, and the S3
>   client is constructed with a 30 s timeout.
>
> Not verified:
> - Production value of `EXPORT_BUCKET`: not set in `.env.example` and the
>   code falls back to `orders-export-dev`. Must be set in production
>   before the deploy and the fallback removed; I have added the variable
>   to `.env.example` and removed the default so boot fails with its name.
> - Staging smoke test: no staging environment reachable from here.
> - Object storage permissions for the production bucket: cannot check
>   without production credentials.
>
> Not applicable:
> - Feature flag: route is admin-only; removing the route is the kill
>   switch.
> - Health endpoint: project has none.
>
> Rollback path once the migration is deferred: redeploy the previous
> release; no schema change in this release, nothing to restore.

## Why it matters

Both answers took about the same effort to read. One of them would have
broken every order page during a Friday afternoon deploy, with a migration
that could not be rolled back, and the on-call engineer would have been
debugging a release that the report had called "production ready, no
security concerns" without a single command having run. The skill version
is not more cautious for its own sake: it found a real memory defect, a
real column dependency and a real configuration gap, and it told the user
exactly which three things it could not check. The user can now decide
whether Friday still holds, with the actual state in front of them.
