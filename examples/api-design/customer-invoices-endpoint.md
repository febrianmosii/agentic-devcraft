# Listing a customer's invoices with filtering

**Skill:** api-design
**Status:** Illustrative

Written by a maintainer to show the intended difference. Not a recorded
transcript.

## Task

> Add an endpoint that lists a customer's invoices. Support filtering by
> status (`draft`, `sent`, `paid`, `void`) and by issue date range. The
> billing dashboard and the partner API will both call it.

Existing API (Express, `src/api/`): thirty-one routes. Lists such as
`GET /customers` and `GET /customers/{id}/payments` take `cursor` and
`limit` (default 25, max 100) and return
`{ "data": [...], "next_cursor": "..." | null }`. Errors everywhere are
`{ "error": { "code": "...", "message": "...", "fields": [...] } }` with
`422` for validation. Auth is a bearer token resolved to an account;
`customers.ts` checks `customer.account_id === req.account.id` before
returning anything. `openapi.yaml` at the repo root is linted in CI.

## Without the skill

The agent adds `src/api/invoices.ts`:

- `POST /getInvoices` taking `{ customerId, status, from, to }` in the body
  "because filters are easier as JSON".
- Runs `SELECT * FROM invoices WHERE customer_id = ?` plus optional filters.
  No limit. A customer with 40,000 invoices gets 40,000 invoices.
- Returns `200` on every outcome. Failures look like
  `{ "success": false, "error": "Customer not found" }`; a database error
  returns `{ "success": false, "error": err.message }`, which includes the
  SQL.
- Checks that the bearer token is valid. Does not check that the customer
  belongs to the caller's account; any authenticated partner can read any
  customer's invoices by guessing IDs.
- `status` is passed to the query as received; `status=paid'--` is caught
  by the parameterised query, but `status=anything` returns an empty list
  rather than a validation error.
- `openapi.yaml` is untouched; CI's spec lint passes because the spec simply
  does not mention the endpoint.

Report: "Added a flexible invoice listing endpoint with filtering. Tested
manually with Postman." Three consumers now have a third style of list
endpoint to learn, one of them with an unbounded response and a cross-tenant
data leak.

## With the skill

The agent reads `GET /customers`, `GET /customers/{id}/payments` and the
shared error middleware, then writes the contract into the plan:

> Mirrors `GET /customers/{id}/payments`.
> `GET /customers/{id}/invoices?status=&issued_from=&issued_to=&cursor=&limit=`
> `status`: one of `draft|sent|paid|void`, repeatable; `issued_from`/`issued_to`:
> ISO dates, inclusive; `limit` default 25, max 100 (shared `parsePagination`).
> `200` → `{ "data": Invoice[], "next_cursor": string|null }`.
> `401` without token; `404 not_found` when the customer does not belong to
> the caller's account (the project returns 404, not 403, for other tenants'
> resources everywhere; keeping that). `422 validation_failed` with `fields`
> for a bad `status` or date.
> Spec: new path in `openapi.yaml` with one request example and one response
> example, `Invoice` schema reused from `GET /invoices/{id}`.
> Out of scope: sorting (payments has none either); noted for the report.

Implementation: one route in `src/api/invoices.ts` next to the payments
route; the customer lookup goes through the existing
`loadOwnedCustomer(req, id)` helper so the tenant check is the same code
path as every other customer sub-resource; filters validated with the
project's existing schema validator; cursor pagination via the shared
helper; `openapi.yaml` updated. Tests added alongside the payments tests:
default page size, `limit=500` clamped to 100, an invalid `status` yields
`422` with `fields[0].field === "status"`, and a token for account A
requesting account B's customer yields `404` with the standard body.

Report:

> Added `GET /customers/{id}/invoices` modelled on
> `GET /customers/{id}/payments` (same pagination, error shape, tenant
> check). Filters: `status` (repeatable enum), `issued_from`, `issued_to`.
> Additive: no existing contract changed. Spec updated with examples;
> `npm run lint:openapi` clean.
> Verified: `npm test -- invoices` → 9 passed, 0 failed, including
> cross-account access (404) and pagination bounds.
> Not done: sorting parameters (not requested; payments endpoint has none).
> Note: the project returns `404` rather than `403` for other tenants'
> resources; followed that policy.

## Why it matters

Both versions return invoices. The first one works in a demo and fails in
production: a cross-tenant read, an unbounded query, a new error dialect,
and a spec that no longer describes the API. Each would be found later by a
different person: a security reviewer, an on-call engineer, a partner
developer, a client generator. The second one is boring in the right way:
a reviewer who knows the payments endpoint can read it in minutes, the
partner API needs no new documentation beyond the spec diff, and the
tests pin the two properties that matter most, tenant isolation and bounded
responses.
