# Refactoring a report generator

**Skill:** clean-code
**Status:** Illustrative

Written by a maintainer to show the intended difference. Not a recorded
transcript.

## Task

> `generate()` in `reports/monthly.py` is 140 lines and nobody wants to
> touch it. Make it readable without changing what it outputs. The existing
> tests in `tests/test_monthly.py` must keep passing.

The function reads orders from the database, filters by status and date,
computes totals per region with a special case for one legacy region code,
formats a CSV, and uploads it. Errors from the upload are caught and ignored.

## Without the skill

The agent rewrites the module from scratch:

- Replaces the function with a `MonthlyReport` class, a `ReportBuilder`, a
  `RegionAggregator` and a `CsvWriter` protocol.
- Renames the output columns to snake_case "for consistency", which changes
  the CSV header.
- Removes the legacy region special case as "dead code" (it is not; one
  tenant still uses it).
- Converts the module to use `dataclasses` and `typing.Protocol`, adding
  imports the rest of the package does not use.
- Reformats the whole file with a different line length.

Report: "Refactored the report generator into clean, testable components.
Tests updated to match the new API." Three tests were changed to accept the
new header, which masks the behaviour change.

## With the skill

The agent reads `generate()` and its tests first, then lists what it will
do and what must not change:

> Smells: one 140-line function mixing query, aggregation, formatting and
> upload; `d`, `r`, `tmp` names; nested status/date filter four levels deep;
> `except: pass` around the upload; literal `"RG-OLD"` region code with no
> explanation.
> Must not change: CSV header and row format, the legacy region mapping, the
> upload destination, the function's public name and signature.

It runs the tests before touching anything (`pytest tests/test_monthly.py`:
9 passed) and then, in the same file and same style:

- Extracts `fetch_orders(month)`, `totals_by_region(orders)`,
  `render_csv(totals)` and `upload(csv_text)` as module-level functions
  called in order by `generate()`, which is now 12 lines.
- Renames `d` → `orders`, `r` → `totals`, `tmp` → `row`.
- Replaces the nested filter with a guard clause per condition.
- Names the literal: `LEGACY_REGION_CODE = "RG-OLD"` with a one-line comment
  stating which tenant still sends it.
- Replaces `except: pass` with `except UploadError as exc:
  logger.error("monthly report upload failed: %s", exc); raise`. This is a
  behaviour change, so it is called out, not hidden.

It runs the tests again (9 passed) and compares the generated CSV for the
fixture month byte-for-byte with the pre-refactor output.

Report:

> Split `generate()` into four named steps; renamed single-letter
> variables; flattened the filter with guard clauses; named the legacy
> region literal.
> One intentional behaviour change: upload failures are now logged and
> re-raised instead of silently ignored. Previously a failed upload produced
> a successful exit. Say if you want the old behaviour kept.
> Verified: `pytest tests/test_monthly.py` → 9 passed before and after;
> CSV output for the March fixture is identical (`diff` clean).
> Noticed, not changed: `fetch_orders` issues one query per region; see
> `database` skill if you want that addressed.

## Why it matters

The first version is a rewrite wearing a refactor's name. It changed the
output, deleted live behaviour, introduced an architecture the package does
not use, and edited the tests to hide the differences. The second version
is readable in the same way the rest of the package is, preserves every
output byte, and surfaces the single deliberate behaviour change as a
decision for the user instead of a surprise for the on-call engineer.
