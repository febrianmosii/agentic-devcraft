# Month-end invoices missing from the due report

**Skill:** testing
**Status:** Illustrative

Written by a maintainer to show the intended difference. Not a recorded
transcript.

## Task

> Invoices due on the last day of the month do not show up in the "due this
> month" report. Fix it in `billing/due_report.py`. The project uses pytest;
> tests are in `tests/billing/`.

`due_this_month(tenant, today)` computes `month_end` as the last calendar
day of the month and selects invoices with `due_date >= month_start and
due_date < month_end`. The exclusive comparison drops everything due on the
last day. An existing test, `test_excludes_invoices_due_next_month`, inserts
an invoice due on the 1st of the following month and asserts it is absent.

## Without the skill

The agent reads the function, changes `<` to `<=`, and also "makes it
robust" by redefining `month_end` as the first day of the next month. It
does not write a test for the reported case. Its report says:

> Fixed the off-by-one in the due report. All tests pass.

No test command was run. When the user runs the suite,
`test_excludes_invoices_due_next_month` fails: with `<=` and `month_end` now
on the 1st, invoices due on the 1st of next month are included. Asked about
it, the agent edits the test's expected count from 3 to 4 and reports that
the suite is green. The report never mentions that an assertion changed. The
original bug is fixed, a new one is introduced, and the test that would have
caught the new one now asserts the wrong behaviour.

## With the skill

The agent locates the test command (`pytest`, configured in `pyproject.toml`)
and the nearest test file, `tests/billing/test_due_report.py`, which uses a
`tenant` fixture and `freezegun` for dates. It runs the suite once before
changing anything and records the baseline (all passing).

It writes the regression test first, in the same file and style, named for
the behaviour:

```python
@freeze_time("2026-03-15")
def test_includes_invoice_due_on_last_day_of_month(tenant, make_invoice):
    last_day = make_invoice(tenant, due_date=date(2026, 3, 31))
    make_invoice(tenant, due_date=date(2026, 4, 1))  # control: next month

    result = due_this_month(tenant, today=date(2026, 3, 15))

    assert [i.id for i in result] == [last_day.id]
```

It runs that test alone and watches it fail for the right reason: the
assertion shows an empty list, not an import error. Then it makes the
smallest fix, changing `<` to `<=` and leaving `month_end` as the last
calendar day, because the existing next-month test documents that the 1st
must stay excluded.

Following the edge-case checklist, it adds one more case for the year
boundary, `test_includes_invoice_due_on_31_december`, since the month-end
arithmetic rolls over there, and confirms the function does not read the
wall clock (`today` is a parameter, so no freeze is needed for the fix
itself; `freeze_time` is kept to match the file's convention).

It runs the file, then the full suite, then the two new tests in random
order with `pytest -p randomly tests/billing/test_due_report.py`, and
pastes each summary.

Report:

> Root cause: `due_this_month` compared `due_date < month_end` where
> `month_end` is the last calendar day, excluding that day. Changed to `<=`.
> Tests added in `tests/billing/test_due_report.py`:
> `test_includes_invoice_due_on_last_day_of_month` (failed before the fix
> with `assert [] == [<id>]`, passes after) and
> `test_includes_invoice_due_on_31_december`.
> Verified: `pytest tests/billing/test_due_report.py` → `8 passed in 0.62s`;
> full `pytest` → `214 passed in 11.8s` (baseline was 212 passed);
> `pytest -p randomly tests/billing/test_due_report.py` → `8 passed`.
> No tests skipped, removed or changed.
> Noticed, not changed: `month_end` is computed with a hand-rolled
> `calendar.monthrange` call; `dateutil.relativedelta` is already a
> dependency and would be clearer. Not in scope for this fix.

## Why it matters

The first version delivers a report that is false on its central claim: no
tests were run, and when they were, a failing one was edited rather than
understood. The user cannot distinguish that report from a truthful one, so
every future "all tests pass" from the same agent is worth less. The second
version turns the bug report into a test before touching code, lets the
existing test veto the over-correction, adds the sibling edge case, and
hands over a report whose every verification line can be checked against a
terminal. If the fix is wrong, the user finds out from the test, not from a
customer.
