# Readiness checklist

Copy the relevant items into the plan before running anything. For each
item record one of: **verified** (command or file, observed result),
**not verified** (why), **not applicable** (why). An item with no entry is
not verified.

Prefer the project's own commands. Look in `package.json` scripts,
`Makefile`, `composer.json`, `pyproject.toml`, `Cargo.toml`, the CI
workflow files, and `README`/`CONTRIBUTING` before inventing one.

## 1. Build and types

| Item | How to check |
|---|---|
| Build or compile succeeds on the current tree | Run the project build (`npm run build`, `go build ./...`, `cargo build --release`, `mvn -q package`, `php -l` over changed files). Record exit code. |
| Type-check passes | `tsc --noEmit`, `mypy`, `pyright`, `phpstan analyse`, `psalm`. Record error count. |
| Lint passes or only has pre-existing findings | Run the configured linter; compare with the base branch if it was already failing. |
| Lockfile matches manifest | `npm ci` (not `install`), `composer install --no-scripts` dry run, `pip check`; a lockfile diff with no manifest diff is a flag. |
| Production build excludes dev artefacts | Inspect the build output or Dockerfile for source maps, dev dependencies, test fixtures. |

## 2. Tests

| Item | How to check |
|---|---|
| Full suite runs and the summary is quoted | Run it. Quote `N passed, M failed, K skipped` and the exit code. |
| New behaviour is covered | Name the test file and case for each new code path. |
| Skipped or quarantined tests are explained | `grep -rn "skip\|xit(\|@Ignore\|markSkipped"` in the diff; each one has a reason. |
| Tests do not depend on local state | The suite passes from a clean checkout or in CI; note if only a local run was possible. |
| Integration or end-to-end suite | Run if available; otherwise list as not verified with the missing prerequisite (database, browser, credentials). |

## 3. Environment configuration

| Item | How to check |
|---|---|
| No environment-specific literals in code | `grep -rnE "localhost|127\.0\.0\.1|\.local\b|staging|sandbox" src/` (adjust paths); each hit is test-only or justified. |
| Every variable the code reads is documented | List reads (`process.env.X`, `env('X')`, `os.environ["X"]`, `os.Getenv("X")`) and compare with `.env.example`, config schema, Helm values, or deployment docs. |
| No silent fallback for environment-specific values | Each read either has no default or a default that is safe in production (not a dev host or test key). |
| Startup validates configuration | A missing required variable fails at boot with its name; demonstrate by unsetting one locally if the app can start here. |
| Production config has debug off | `APP_DEBUG=false`, `DEBUG=False`, `NODE_ENV=production`, no `--inspect`, no verbose SQL logging. |
| Config changes are deployed with the code | New variables are set in the target environment before or with the deploy; otherwise state that they must be. |

## 4. Secrets and security

| Item | How to check |
|---|---|
| No secrets in the diff or history | `git diff --cached --name-only`, `git log --all --diff-filter=A --name-only -- '*.env*' '*.pem' '*.key'`. Run `gitleaks detect` or `trufflehog git file://.` if installed. |
| Credential literals absent | `grep -rnE "AKIA[0-9A-Z]{16}|sk_live_|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY"`. |
| Dependency audit | `npm audit --omit=dev`, `pnpm audit --prod`, `composer audit`, `pip-audit`, `cargo audit`, `govulncheck ./...`, `bundle audit check`. Quote the high/critical count. |
| New endpoints are authenticated and authorized | Name the middleware, policy or guard on each new route. |
| Input at boundaries is validated | Request schemas, size limits, file-type checks for uploads. |
| Error responses hide internals in production | Stack traces, SQL and file paths do not reach the client when debug is off. |

## 5. Logging and monitoring

| Item | How to check |
|---|---|
| New log lines are structured and carry context | Request id, job id, entity id present; message is a constant, data is in fields. |
| No sensitive data in logs | Grep new log calls for `password`, `token`, `secret`, `authorization`, card or personal fields; request bodies are not logged wholesale. |
| Errors are recorded, not swallowed | Every `catch` in the diff logs with context, increments a metric, or rethrows. |
| Health and readiness endpoints reflect new dependencies | A new required dependency (database, cache, queue, external API) is part of the readiness check; optional ones are not. |
| Metrics or alerts exist for the new failure modes | Name the counter, histogram or alert; or state that the project has none. |

## 6. Error handling at boundaries

| Item | How to check |
|---|---|
| Every outbound call has a timeout | Inspect client construction (`timeout`, `connectTimeout`, `readTimeout`, context deadlines). |
| Retries are bounded with backoff | Max attempts and backoff are explicit; non-idempotent requests are not retried without an idempotency key. |
| Non-critical dependencies degrade gracefully | For each optional dependency, name what the main path does when it is unavailable. |
| Partial failures are not left half-written | Multi-step writes are transactional, idempotent, or compensated. |
| Queue consumers and cron jobs report failure | A failing job is retried with a limit, dead-lettered, or alerted; it does not disappear. |

## 7. Deployment

| Item | How to check |
|---|---|
| Migrations are compatible with the running release | Walk through [deployment-risks.md](deployment-risks.md) section 1. |
| Backup before destructive steps | Command and location recorded (`mysqldump`, `pg_dump`, snapshot id). |
| Rollback path is named and realistic | Previous release redeploy, `down` migration that was run locally, or restore from the named backup. |
| Zero-downtime constraints are respected | Long-running workers, in-flight jobs and cached routes survive the switch, or a restart is scheduled. |
| Feature flag or kill switch | Present where the change is user-facing and not trivially revertible. |
| Deploy order is written down | Set config, run migration, deploy code, restart workers, clear caches, in the order the pipeline actually executes. |

## 8. Operational risk

| Item | How to check |
|---|---|
| Behaviour at 10x current volume | Identify loops over unbounded collections, N+1 queries, in-memory accumulation, synchronous fan-out. |
| New single points of failure | Each new external service, host, queue or cache, with its failure behaviour. |
| Resource limits | Memory, file descriptors, connection pool size for the new path. |
| Data growth | New tables or columns: expected row growth and retention. |
| Who gets paged | The owner or on-call contact for the new failure modes, if the project has such a thing. |
