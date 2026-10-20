# Edge-case checklist

Walk this list for every new behaviour and every bug fix. For each class,
either write the test or state in one sentence why the case cannot occur
(for example, the type system or a database constraint rules it out).
Most changes need three to six of these, not all of them.

## Numbers and boundaries

- Zero, one, the exact limit, limit plus one, limit minus one.
- Negative where only positive is expected; `-0` and `NaN` in languages that have them.
- Integer overflow at 32-bit and 64-bit boundaries; floating-point comparison with a tolerance, not `==`.
- Division by zero and modulo of a negative number.
- Pagination: empty last page, total that divides evenly, page past the end, `perPage` of zero.
- Money: rounding mode, half-cent values, currencies with zero or three decimal places.

## Collections

- Empty, exactly one element, two elements (first vs last distinction), the maximum the UI or API accepts.
- Duplicates where uniqueness is assumed.
- Order: does the caller rely on an order the storage does not guarantee?
- Mutation during iteration.

## Strings and encoding

- Empty string and whitespace-only; leading and trailing whitespace.
- Length at the column or validation limit, measured in bytes vs characters vs grapheme clusters.
- Characters outside the Basic Multilingual Plane (four bytes in UTF-8): names, comments, file names.
- Combining marks and normalisation (`é` as one code point vs two): equality, search, uniqueness.
- Right-to-left text and bidirectional control characters in anything rendered or logged.
- Case folding: `ß`, Turkish dotless `i`, when comparing emails or usernames.
- Injection surfaces: quotes, backslashes, `<`, `%`, null byte, newline in a header or CSV cell.

## Null, missing and optional

- `null` vs `undefined` vs absent key vs empty string vs `0` vs `false`: which does the code treat the same, and should it?
- Optional nested objects: `user.address.postcode` when `address` is missing.
- Defaults applied twice or at the wrong layer.
- Partial updates that omit a field: untouched or cleared?

## Time

- The last day of the month, 31 December, 29 February, and a year boundary.
- Midnight: inclusive vs exclusive range ends; `< end_of_day` vs `<= end_of_day`.
- Time zones: a date that is "today" locally and "yesterday" or "tomorrow" in UTC; a tenant east and west of UTC.
- Daylight saving transitions: an hour that does not exist and one that occurs twice.
- Durations across DST: 24 hours is not always one calendar day.
- Clock source: tests must inject or freeze `now()`; a test that depends on the wall clock will fail on the day you are not watching.
- Serialisation: ISO 8601 with and without offset; Unix seconds vs milliseconds.

## Concurrency and repetition

- Double submit of the same form or webhook; retried request after a timeout. Is the operation idempotent?
- Two writers updating the same row: last-write-wins, optimistic lock, or unique-constraint violation?
- Job executed twice by a queue with at-least-once delivery.
- Cancellation or shutdown mid-operation; partially written state.
- Order of asynchronous completion differing from order of start.

## External input and I/O

- Network timeout, connection refused, 5xx, malformed body, a 200 with an error in the payload.
- Partial read, truncated file, file that disappears between `exists` and `open`.
- Permissions: read-only directory, missing environment variable, expired credential.
- Payload size at and above the configured limit.

## Authorisation and identity

- Logged-out user, user from another tenant, user with the right role but not the right resource.
- Soft-deleted, suspended or unverified accounts.
- Token expired, revoked, or valid but for a different audience.

## State and lifecycle

- Entity in each status: can the transition be requested from a status where it is not allowed?
- Re-running a migration, seed or import on data that was already processed.
- Feature flag on and off, where the change is gated.

## Picking which to apply

Ask what the change touches. A string column: strings, null, length. A date
filter: time, boundaries. A background job: concurrency, repetition, I/O. An
endpoint: authorisation, input, null. A bug fix: the reported case plus its
nearest siblings from the same class (an off-by-one at the end of a range
usually has a twin at the start).
