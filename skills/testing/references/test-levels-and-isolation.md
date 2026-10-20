# Test levels and isolation

## Choosing the level

| Level | Proves | Fakes | Cost | Use for |
|---|---|---|---|---|
| Unit | One function or class produces the right output for an input | Everything outside the unit that is slow or external | Milliseconds | Logic, parsing, validation, calculations, state machines |
| Integration | Our code works with a real collaborator: database, queue, filesystem, HTTP client against a local server | Only third parties outside the process, and only when unavoidable | Tens of milliseconds to seconds | Queries, migrations, serialisers, ORM behaviour, framework wiring (routing, middleware, DI) |
| End-to-end | A user-visible flow works across the deployed stack | Nothing, or only payment and email providers | Seconds to minutes | A handful of critical journeys (sign up, checkout, submit the form); smoke after deploy |

Decide by asking where the defect could live:

- If the bug is in arithmetic, branching or formatting, a unit test catches it and an end-to-end test only catches it slowly.
- If the bug is in a query, a column type, a JSON shape or a framework convention, a unit test with a mocked repository will pass while production fails. Use the real database.
- If the bug is in how services talk to each other, one end-to-end test is worth more than any number of mocked integration tests.

A healthy suite has many unit tests, fewer integration tests, and very few
end-to-end tests. Inverting that produces slow, flaky suites that nobody runs
locally.

## Test doubles: what to fake

Fake at the boundary you do not own: third-party HTTP APIs, payment gateways,
email, SMS, the wall clock, randomness. Do not fake your own classes to make
a test easier; if a class is hard to test, that is a design signal, not a
reason for more mocks.

| Need | Prefer | Avoid |
|---|---|---|
| Database | Real database in a transaction rolled back per test, or a per-test schema | Mocking the ORM |
| HTTP to a third party | Recorded or hand-written responses via an interceptor (`nock`, `msw`, `responses`, `httpretty`, `Http::fake()`, `httptest.Server`) | Live calls; mocking your own client wrapper's methods |
| Time | Injected clock or framework freeze (`jest.useFakeTimers`, `freezegun`, `Carbon::setTestNow`, `time.Now` as a variable) | `sleep`; asserting against `datetime.now()` |
| Randomness and IDs | Seeded generator or injected ID factory | Asserting that a value "looks like" a UUID |
| Email, queue, events | Framework fakes that record what was sent (`Mail::fake()`, in-memory transport) and assert on recipient and payload | Only asserting the sender was called |

A spy that checks "was called" is acceptable only when the call *is* the
behaviour (an event was published) and the assertion includes the arguments.

## Isolation rules

Each test owns its state:

- Create the data the test needs inside the test or in a fixture it visibly uses. Never rely on rows another test left behind or on a shared seed that tests mutate.
- Reset module-level and static state between tests (singletons, caches, registries, environment variables). Most frameworks provide a hook: `beforeEach`, `setUp`, `TestMain`, `setUpBeforeClass` with a matching teardown.
- Use a temporary directory per test (`tmp_path`, `t.TempDir()`, `os.tmpdir()` plus a unique prefix) and never write into the repository.
- Do not read the real network or wall clock unless the test is an integration test that says so in its name or file location.

## Proving isolation

Run the new tests three ways and paste each summary:

```
# alone
pytest tests/test_due_report.py::test_includes_invoice_due_on_last_day
npx jest -t "includes invoice due on last day"
vendor/bin/phpunit --filter includes_invoice_due_on_last_day
go test ./billing -run TestDueReport_IncludesLastDay

# in random order
pytest -p randomly
npx jest --randomize
vendor/bin/phpunit --order-by=random
go test ./... -shuffle=on

# repeated, to surface flakiness
pytest --count=10 tests/test_due_report.py   # pytest-repeat
go test ./billing -count=10
```

If the project lacks a random-order plugin, run the file in reverse by
listing the tests explicitly; order dependence usually shows up immediately.

## Determinism checklist

- No `sleep`, `setTimeout` or polling without a bound; await the actual completion.
- No dependence on list order from a query without `ORDER BY`.
- No dependence on the current date, locale, time zone or hostname of the machine running the suite. Set `TZ=UTC` (or the project's chosen zone) in the test command if the code reads the system zone.
- No test that passes only when run after another, or only on the first run (leftover files, cached results).
- Parallel runners (`pytest -n`, `jest --maxWorkers`, `phpunit --parallel`, `go test -parallel`) use separate databases or schemas per worker.

## When the project has no test setup

Propose the smallest harness that the ecosystem's default tooling runs, and
write exactly one test with it:

| Ecosystem | Minimal harness |
|---|---|
| Node | `npm i -D vitest` or `jest`; `"test": "vitest run"` in `package.json`; one `*.test.ts` next to the code or in `tests/` |
| Python | `pytest` (no config needed); `tests/test_<module>.py` |
| PHP / Laravel | `phpunit.xml` is usually present; `php artisan make:test` or one `tests/Unit/<Name>Test.php` |
| Go | Built in; one `<file>_test.go` |
| Rust | Built in; `#[cfg(test)] mod tests` or `tests/` |

State in the report what was added and what the first test covers. If the
user declines, verify by another means (a script, a manual request against a
dev server) and report that method, not "tests pass".
