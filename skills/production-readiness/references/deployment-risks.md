# Deployment risks: migrations, rollback, configuration drift

The three ways a change that passed every test still causes an outage.

## 1. Migrations versus running code

During any deploy that is not a full stop, there is a window where the
schema has changed and the previous release is still serving traffic:
rolling updates, blue/green, symlink switches with warm workers, queue
consumers that pick up old code until restarted. After the deploy, a
rollback reopens the same window in reverse.

A migration is safe only if **both** the previous release and the new
release run correctly against the schema it produces.

### Expand and contract

Split every incompatible change into two releases.

| Change | Release N (expand) | Release N+1 (contract) |
|---|---|---|
| Rename column `a` to `b` | Add `b`, write to both, backfill `b` from `a`, read `b` with fallback to `a` | Stop writing `a`, drop `a` |
| Drop column | Stop reading and writing it in code | Drop the column |
| Add NOT NULL column | Add as nullable with a default, backfill, make code always write it | Add the NOT NULL constraint |
| Change column type | Add new column, dual-write, backfill | Switch reads, drop old column |
| Rename table | Create new table or view, dual-write | Drop old table |
| Remove enum value | Stop producing it in code; map existing rows | Remove from the enum |
| Split or merge services | New service reads from old store | Cut over, decommission |

Questions to answer for each migration in the diff:

1. Does the previous release read or write anything this migration removes,
   renames or constrains? `grep` the base branch for the column, table or
   enum value.
2. Does the migration lock a large table? `ALTER TABLE` on MySQL without
   `ALGORITHM=INPLACE`, `CREATE INDEX` on PostgreSQL without `CONCURRENTLY`,
   backfills in one transaction. Estimate row count from production if the
   user can tell you; otherwise state it as unknown.
3. Is the migration idempotent, or does a partial failure leave a state the
   pipeline cannot re-run from?
4. Was the `down` migration written, and was it run locally on a migrated
   database? A `down` that was never executed is not a rollback path.

### Data backfills

Treat a backfill as a separate, resumable job, not a migration step:
batched, idempotent, with a progress marker, and runnable while the app
serves traffic. Never backfill inside the schema migration transaction on
a table the app writes to.

## 2. Rollback that works

"Revert the commit" is a rollback for code only. For each kind of change,
the rollback is:

| Change | Realistic rollback |
|---|---|
| Code only | Redeploy previous release or revert commit; confirm caches (`route:cache`, compiled assets, CDN) are rebuilt. |
| Expand migration (additive) | Redeploy previous release; leave the schema expanded. Nothing to undo. |
| Contract migration (destructive) | Restore from the backup taken immediately before, then redeploy previous release. Data written after the migration is lost or must be replayed. |
| Configuration change | Restore previous values; some runtimes need a restart or a config cache clear. |
| Infrastructure change | Previous Terraform/CloudFormation state or plan; verify the old resource still exists. |
| External side effects (webhooks registered, emails sent, third-party records created) | Usually not reversible; design the change so that re-running is safe instead. |

Before any contract migration or bulk data change:

```
# examples; use the project's own backup tooling when it has one
mysqldump --single-transaction --quick "$DB" > "backup-$(date +%Y%m%d-%H%M%S).sql"
pg_dump --format=custom "$DB" > "backup-$(date +%Y%m%d-%H%M%S).dump"
```

Record the path and size in the report. A backup that was not verified to
exist and be non-empty is not a backup.

## 3. Configuration drift

Code is versioned; the environment often is not. Drift appears when:

- A new variable is read by the code but not set in the target environment.
  The deploy succeeds and the first request fails, or worse, a fallback
  silently points at the wrong system.
- A variable was changed by hand on one host of several. Rolling deploys
  then behave differently per host.
- The config cache (`php artisan config:cache`, compiled settings, baked
  images) was built with old values and is not rebuilt by the pipeline.
- Secrets were rotated in the secret store but the running process still
  holds the old value until restart.

Checks:

1. Diff the variables the code reads against the variables the target
   environment defines. Sources: `.env.example`, Helm values, compose files,
   CI secrets list, the deploy script, or ask the user for the production
   list without the values.
2. For each new variable, state who sets it, where, and whether it must be
   set before or after the code deploy.
3. If the pipeline caches configuration, confirm the cache is rebuilt in the
   pipeline, not by hand.
4. Startup validation: the application refuses to start with a clear message
   naming the missing variable. If it does not, that is a finding; add it if
   in scope, otherwise report it.

## 4. Zero-downtime specifics

- **Long-running workers** (queue consumers, schedulers, websocket servers)
  keep executing old code until restarted. Either restart them in the
  pipeline after the switch or make the change compatible with both.
- **In-flight jobs** serialized with the old payload shape must still
  deserialize under the new code.
- **Session and cache formats** shared across releases need the same
  compatibility treatment as database schemas.
- **Static assets**: the old HTML may request hashed asset names that the
  new deploy removed. Keep the previous build's assets available for at
  least one deploy cycle.
- **Health checks**: a new required dependency belongs in the readiness
  probe so a pod that cannot reach it does not receive traffic; it does
  not belong in the liveness probe, where it would cause restart loops
  during a dependency outage.
