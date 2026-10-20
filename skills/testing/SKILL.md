---
name: testing
description: >-
  Produces tests that prove behaviour and reports test results truthfully:
  picks the right level (unit, integration, end-to-end), reproduces a bug with
  a failing test before fixing it, covers boundaries and edge cases, keeps
  tests isolated and deterministic, follows the project's existing test
  framework and layout, and never reports a test run that did not happen.
  Use when writing or fixing tests, fixing a bug, adding a feature that needs
  coverage, dealing with a failing or flaky test, or when the user says "add
  tests", "test this", "make sure it works", "regression", "coverage", "TDD",
  "the tests pass", or asks whether something was verified.
license: MIT
metadata:
  collection: agentic-devcraft
  version: "0.1.0"
---

# Testing

## Purpose

A test is the only part of an agent's output that checks the rest of it. This
skill makes tests worth running: each one states a behaviour, can fail, runs
in isolation, and exists before the fix it protects. It also closes the most
damaging failure an agent can produce: reporting "tests pass" for a run that
never happened, or that was made green by deleting, skipping or weakening the
test that caught the defect.

## When to use

- Fixing a bug: the regression test comes first.
- Adding a feature or changing behaviour that existing tests do not cover.
- Explicit requests: "add tests", "write a test for", "increase coverage",
  "this test is flaky", "why does CI fail".
- Any task where the final report will contain the word "verified".

Not the right skill for deciding *what* the code should do; that is the task
itself. When no test command exists at all, this skill still applies: propose
the smallest harness, do not silently skip verification.

## Rules

Levels: **MUST** (no deviation without a documented exception), **SHOULD**
(deviate with a one-sentence reason), **CONSIDER** (judgment call).

### MUST

- **Report only test runs that were executed, with the actual summary pasted.**
  Prevents: a user merging on the strength of a result that was imagined, remembered from an earlier run, or inferred from reading the code.
  Applies: every statement of the form "tests pass", "verified", "green", "no regressions".
  Exception: none. If the run could not happen, say "not run" and why.
  Verify: the report contains the exact command and the framework's own summary line (`Tests: 12 passed, 12 total`, `3 passed, 1 failed in 0.41s`, `OK (8 tests, 21 assertions)`), copied, not paraphrased.

- **Never delete, skip, mark-as-expected-failure or loosen a failing test to go green without saying so.**
  Prevents: the defect the test caught shipping under a green badge.
  Applies: any edit to an existing test or its fixtures while a run is red; `@skip`, `xit`, `test.skip`, `markTestSkipped`, widened `toBeCloseTo`, `assertTrue(bool(x))`.
  Exception: the test is genuinely wrong about the required behaviour, and the report quotes the old assertion, the new one, and the reason.
  Verify: `git diff -- '*test*'` shows no removed assertions or added skips that the report does not name.

- **Reproduce a bug with a failing test before changing production code.**
  Prevents: fixing a different bug than the one reported, and fixes that silently regress later.
  Applies: every bug fix where the behaviour is testable at some level.
  Exception: build or configuration failures with no code path to assert on; say so in the report.
  Verify: the test was run before the fix and failed for the reported reason (not an import error or a typo), then passed after the fix with no change to the test.

- **Assert behaviour, not implementation; every assertion must be able to fail.**
  Prevents: tests that pass against a stubbed-out or deleted function, `assertTrue(true)`, `expect(fn).toHaveBeenCalled()` as the only check, and snapshots that assert "whatever it did last time".
  Applies: every assertion you write.
  Exception: a spy on an external side effect (email sent, event emitted) when that side effect *is* the behaviour, asserted with its arguments.
  Verify: for each test, name the plausible wrong implementation it would catch; if there is none, the test is decoration.

- **Isolate tests: no shared mutable state, no order dependence, no real network, clock or filesystem unless intended.**
  Prevents: tests that pass alone and fail in CI, flake on a slow runner, or depend on today's date, a live API, or the row another test inserted.
  Applies: all tests; especially fixtures, module-level variables, static singletons, temp directories, environment variables.
  Exception: integration and end-to-end tests that deliberately use a real database or service, in a fresh state they set up and tear down themselves.
  Verify: the new tests pass when run alone, in random order (`pytest -p randomly`, `phpunit --order-by=random`, `go test -shuffle=on`, `jest --randomize`), and with the network disabled.

- **Follow the project's existing test framework, layout and naming.**
  Prevents: a second framework in the repository, test files the runner does not discover, and fixtures duplicated because the existing ones were not found.
  Applies: every new test file or case.
  Exception: no tests exist yet (see next rule).
  Verify: the new file sits where its neighbours sit (`tests/`, `__tests__/`, `*_test.go`, `*Test.php`), uses the same runner, assertion style and fixture mechanism, and appears in the runner's collected count.

- **When no test infrastructure exists, propose the minimal one instead of skipping verification.**
  Prevents: "no tests in this project" becoming a permanent excuse for unverified changes.
  Applies: repositories with no runner configured, or none for the language you are touching.
  Exception: the user explicitly declines tests; then verify another way (manual request, script) and report that.
  Verify: the report names the proposed runner, the one file it needs, and what the first test would cover; or records the user's decision to skip.

### SHOULD

- **Choose the test level by where the defect could live.**
  Prevents: unit tests with twenty mocks that prove nothing about the wiring, and end-to-end tests used for arithmetic.
  Applies: planning the tests for any change.
  Exception: the project has only one level available and adding another is out of scope.
  Verify: pure logic has unit tests; code whose risk is in a query, a serialiser or a third-party contract has an integration test against the real thing; user-visible flows that span services have one end-to-end check, not twenty.

- **Cover the edges that the change makes reachable.**
  Prevents: the off-by-one at the boundary, the empty list, the null field, the four-byte Unicode name, the double-submitted form, the date that is tomorrow in UTC.
  Applies: every new behaviour; every bug fix (the sibling of the reported case).
  Exception: edges the type system already rules out.
  Verify: walk [references/edge-case-checklist.md](references/edge-case-checklist.md) and either test each applicable class or state why it cannot occur.

- **Name each test after the behaviour it states.**
  Prevents: `test1`, `testProcess`, `it("works")`, and failures that need the test body opened to understand what broke.
  Applies: all test names and descriptions.
  Exception: table-driven tests where the row label carries the behaviour.
  Verify: the failure line alone (`FAIL rejects_expired_token_with_401`) tells a reader what is broken.

- **Keep tests deterministic and fast.**
  Prevents: `sleep(2)` synchronisation, random data without a seed, tests that pass only before midnight, and suites nobody runs because they take twenty minutes.
  Applies: all tests you write; flaky tests you are asked to fix.
  Exception: a documented slow or soak suite run separately from the default command.
  Verify: the test passes ten times in a row (`pytest --count=10`, `go test -count=10`, `jest --testNamePattern x` in a loop); no wall-clock sleeps; time, randomness and IDs are injected or frozen.

- **Test one behaviour per test, with the setup visible.**
  Prevents: a single test with fourteen assertions where the first failure hides the rest, and setup buried in a fixture chain nobody can trace.
  Applies: new tests.
  Exception: a scenario test that intentionally walks a sequence (create, update, delete) and documents it as such.
  Verify: each test has one reason to fail; a reader sees the input and the expected output in the test body or an obviously named helper.

### CONSIDER

- **Property-based tests** (`hypothesis`, `fast-check`, `testing/quick`) for pure functions with a wide input domain, alongside, not instead of, named examples.
- **A contract test against the real dependency** (a database in a transaction, a recorded HTTP exchange) when mocking it would just restate your assumptions about it.
- **Re-running the new test against the unfixed code** (stash the fix) when you did not watch it fail the first time, to prove it detects the defect.
- **Adding a seam for time or randomness** (injectable clock, seedable generator) when the code calls `now()` or `random()` directly and the test has to fight it.

Levels, doubles and ecosystem commands:
[references/test-levels-and-isolation.md](references/test-levels-and-isolation.md).

## Workflow

- **Understand:** find the test command the project actually uses (`package.json` scripts, `Makefile`, `composer.json`, `pytest.ini`, CI config) and read the nearest existing test file for framework, fixtures and naming. Run the suite once before changing anything and record the baseline; pre-existing failures are not yours to fix but must be reported.
- **Plan:** for each behaviour in the change, decide the level and list the cases: the happy path, the reported bug, and each applicable edge class. Decide what is faked (time, network, randomness) and what is intentionally real.
- **Implement:** for bugs, write the test, run it, watch it fail for the right reason, then fix. For features, write the test with the code, not after the report. Mirror the neighbours' style.
- **Verify:** run the targeted file, then the full default suite (or the same subset CI runs). Compare with the baseline. Run new tests alone and in random order. If an unrelated test fails, leave it and report it.
- **Report:** the command, the pasted summary, the baseline comparison, the tests added by name, and every test skipped, removed or changed with the reason.

## Examples

Before: a test that cannot fail for any interesting reason.

```js
test("pageCount works", () => {
  const result = pageCount(100, 10);
  expect(result).toBeDefined();
  expect(typeof result).toBe("number");
});
```

After: boundaries, the empty case and the invalid input, each named for its behaviour.

```js
describe("pageCount", () => {
  test("returns one page when total is smaller than a page", () => {
    expect(pageCount(3, 10)).toBe(1);
  });
  test("does not add an empty page when total divides evenly", () => {
    expect(pageCount(100, 10)).toBe(10);
  });
  test("rounds a partial last page up", () => {
    expect(pageCount(101, 10)).toBe(11);
  });
  test("returns zero pages for an empty collection", () => {
    expect(pageCount(0, 10)).toBe(0);
  });
  test("rejects a page size of zero", () => {
    expect(() => pageCount(5, 0)).toThrow(RangeError);
  });
});
```

Report fragment, with the summary line copied from the terminal rather than
written from memory:

> Added 5 cases in `src/pagination.test.js`. Ran `npx jest src/pagination`
> → `Tests: 5 passed, 5 total`. Full suite `npm test` → same totals as the
> baseline plus 5. No tests skipped or changed.

Full scenario: [examples/testing/month-end-invoice-regression.md](../../examples/testing/month-end-invoice-regression.md).

## Anti-patterns

- **Phantom run.** "All tests pass" with no command and no summary in the report. Correction: run it, paste the summary; if you cannot run it, write "not run" and why.
- **Green by deletion.** Removing, skipping or `xfail`-ing the test that fails after your change. Correction: fix the code; if the test is wrong, quote old and new assertion in the report.
- **Tautological test.** `expect(result).toBeDefined()`, `assertTrue(True)`, asserting the mock returned what you told it to return. Correction: assert the observable output for a concrete input that a wrong implementation would get wrong.
- **Mock the universe.** Stubbing every collaborator, including the project's own classes, so the test only checks that calls happened in order. Correction: mock at the external boundary only; let your own code run.
- **Snapshot everything.** `toMatchSnapshot()` on a whole page or payload, then `-u` whenever it changes. Correction: assert the fields the behaviour is about; use snapshots only for stable, reviewed output.
- **Sleep-based sync.** `sleep(500)` or `setTimeout` to wait for async work. Correction: await the promise, poll with a bounded timeout, or use the framework's fake timers.
- **Fixture coupling.** Test B passes only because test A inserted the row it reads. Correction: each test creates what it needs; run in random order to prove it.
- **Testing the method name.** `test_process()` calling `process()` with one input and asserting nothing specific. Correction: one test per behaviour, named for the behaviour.

## Verification checklist

- [ ] The project's own test command was identified and a baseline run was recorded before changes.
- [ ] For a bug fix, a test failed for the reported reason before the fix and passed after it, unchanged.
- [ ] Every new assertion could fail against a plausible wrong implementation.
- [ ] New tests pass alone, in random order, and without network access.
- [ ] Time, randomness and external services are controlled or deliberately real; no sleeps.
- [ ] New tests live where the runner finds them and follow the neighbours' framework and naming.
- [ ] The applicable edge classes were tested or explicitly ruled out.
- [ ] No test was deleted, skipped or weakened without a stated reason.
- [ ] The report contains the exact command and the pasted summary line, or an explicit "not run".

## Output

The report states which tests were added or changed (by name), the exact
command that was run, the framework's summary line copied verbatim, and how
that compares with the baseline. It names every test skipped, removed or
weakened and why. It must never claim a run that did not happen, round a
partially failing run up to "passing", or describe a test that was made
to pass by editing its assertion as a fix.
