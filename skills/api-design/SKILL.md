---
name: api-design
description: >-
  Designs and changes HTTP APIs so they stay consistent with the API already in
  the project: resource naming, correct HTTP methods and status codes, one
  error shape, boundary validation, pagination, authentication and per-object
  authorization, versioning and backward compatibility, idempotency, and a
  spec kept in sync. Use when adding or changing an endpoint, route, REST
  resource, webhook, API response or error format, pagination, API versioning,
  or an OpenAPI document, or when asked "how should this API look?".
license: MIT
metadata:
  collection: agentic-devcraft
  version: "0.1.0"
---

# API design

## Purpose

Agents design endpoints from a textbook instead of from the codebase: a
`POST /getInvoices` next to forty `GET /resources`, a fresh `{success:false}`
error body beside the project's `{error:{code,message}}`, a rename that
breaks the mobile app, a list that returns every row. Each one is locally
reasonable and globally wrong. This skill makes the agent read the existing
API first, follow its conventions, apply HTTP semantics where the project
has no convention, and treat any change to a published contract as a
migration with named consumers.

## When to use

- Adding, changing or removing an endpoint, route, handler or resolver.
- Changing a request or response body, a query parameter or a header.
- Designing or changing error responses, pagination, filtering or sorting.
- Adding authentication or authorization to an endpoint.
- Introducing or changing API versioning; deprecating a field or endpoint.
- Writing or updating an OpenAPI/Swagger, JSON Schema or similar spec.
- Receiving or emitting webhooks.

Rules are written for HTTP/REST-style APIs. GraphQL and RPC differ in
transport but not in contract: naming, error shape, authorization per
object, additive change and documented deprecation still apply.

## Rules

Levels: **MUST** (no deviation without a documented exception), **SHOULD**
(deviate with a one-sentence reason), **CONSIDER** (judgment call).

### MUST

- **Match the project's existing API conventions before any textbook rule.**
  Prevents: two naming styles, two envelopes, two error shapes and two auth schemes in one API, each one "correct".
  Applies: any endpoint added to an API that already has endpoints; covers path style, casing, envelope, error body, pagination parameters, auth header, date and ID formats.
  Exception: the task is explicitly to change the convention, and the change covers all existing endpoints or a written migration plan.
  Verify: the new endpoint is indistinguishable in style from its nearest existing sibling; the plan names which sibling was used as the template.

- **Do not change an existing endpoint's contract without listing its known consumers and the migration path.**
  Prevents: breaking clients you cannot see: mobile apps, partner integrations, scheduled jobs, other services, cached responses.
  Applies: removing or renaming a field or parameter, changing a type, format or semantics, tightening validation, changing a status code, changing auth requirements.
  Exception: the API has no consumers outside the current change set, and the report says how that was established (grep, API gateway logs, project docs).
  Verify: the plan contains a consumer list (possibly "internal only, callers: ...") and a migration step for each; or the change is additive. See [references/compatibility-and-versioning.md](references/compatibility-and-versioning.md).

- **Use HTTP methods and status codes for what they mean.**
  Prevents: clients that cannot retry safely, caches that cache errors, monitoring that sees 200s while users see failures.
  Applies: every endpoint. `GET`/`HEAD` are safe; `PUT`/`DELETE` are idempotent; `POST` is neither. Create returns `201` with the new resource or a `Location`; deletes and empty updates return `204`; client faults are `4xx`, server faults are `5xx`.
  Exception: a project-wide convention already deviates (for example an RPC-style API that is `POST` only), in which case follow it and say so.
  Verify: no `GET` has side effects; no error leaves with `200`; no `5xx` is returned for a caller's mistake. Cheat sheet: [references/http-semantics.md](references/http-semantics.md).

- **Return one error shape across the API.**
  Prevents: clients with a parser per endpoint; support staff reading stack traces in production responses.
  Applies: every non-2xx response. The shape carries a machine-readable `code`, a human-readable `message`, and field-level errors for validation failures, in the project's existing layout. No stack traces, SQL, file paths, internal class names or upstream error bodies.
  Exception: none for leaked internals. For shape: a framework default the project has consciously adopted everywhere.
  Verify: the error body of the new endpoint matches an existing endpoint's byte for byte in structure; a forced exception in a test does not expose internals.

- **Authenticate every endpoint and authorize per object.**
  Prevents: data exposure through endpoints that check "logged in" but not "owns this resource" (the classic IDOR).
  Applies: every route; list endpoints filter by what the caller may see, item endpoints check the caller may see *that* item.
  Exception: endpoints explicitly designated public, listed as such in the plan and the report.
  Verify: a test with a valid token for user A requesting user B's resource gets the project's standard refusal; the route is covered by the same auth middleware or policy as its siblings.

- **Validate at the boundary and reject what cannot be processed with the project's `400`/`422` convention.**
  Prevents: half-written records, type errors deep in the stack, and `500`s for bad input.
  Applies: every body, query parameter, path parameter and header the endpoint reads. Decide and document whether unknown fields are rejected or ignored; follow what sibling endpoints do.
  Exception: endpoints that deliberately store opaque payloads (webhook inbox, raw import).
  Verify: a request with a missing required field, a wrong type and an unknown field each produce the documented response; the handler never reaches the database with invalid input.

### SHOULD

- **Name resources as plural nouns; keep nesting to the depth needed to identify the resource.**
  Prevents: `/getInvoice`, `/invoice/list`, `/customer/1/invoice/2/line/3/tax` styles that clients must memorise one by one.
  Applies: new paths. Verbs only for genuine actions that are not CRUD (`POST /invoices/{id}/send`), and only as a sub-resource of the thing acted on.
  Exception: the project's existing style differs; follow it.
  Verify: each path segment is a collection or an identifier, except at most one trailing action segment.

- **Paginate every list the way the project already paginates, with a bounded page size.**
  Prevents: unbounded responses that time out at scale, and three pagination dialects in one API.
  Applies: any endpoint returning a collection. Reuse the existing parameter names and response metadata (`cursor`/`next`, or `page`/`per_page`/`total`). Enforce a maximum page size server-side.
  Exception: collections with a hard, small upper bound (an enum, a user's at most five addresses), stated in the plan.
  Verify: a request without pagination parameters returns the default page, not everything; a request above the maximum is clamped or rejected, matching siblings.

- **Make changes additive by default; deprecate before removing.**
  Prevents: silent breakage for consumers that cannot deploy in step with the server.
  Applies: fields, parameters, enum values, endpoints. Add the new thing, keep the old one working, mark it deprecated in the spec and (where the project does this) in a response header, then remove after the announced period.
  Exception: security fixes where keeping the old behaviour is the vulnerability.
  Verify: existing contract tests pass unchanged; the deprecation is visible in the spec with a date or version.

- **Do not introduce a new API version for a change that can be made additively.**
  Prevents: `v2` directories that duplicate `v1` and diverge, each maintained forever.
  Applies: any proposal to add `/v2/`, `Accept-Version` or a `version` field. When a version is genuinely needed, use the strategy the project already uses; if none exists, choose one and document it.
  Exception: a change in resource semantics that cannot coexist with the old one under the same path.
  Verify: the plan states why additive change was insufficient before any new version appears.

- **Accept an idempotency key on non-idempotent operations that clients will retry.**
  Prevents: double charges, duplicate orders, duplicate outbound webhooks after a timeout.
  Applies: `POST` that creates money movements, orders, messages or any side effect with external cost; webhook receivers (dedupe on the provider's event ID).
  Exception: creates where a duplicate is harmless and cheap to clean up, stated in the plan.
  Verify: replaying the same request with the same key returns the original result and performs the side effect once (covered by a test).

- **Keep the API spec and examples in sync with the code in the same change.**
  Prevents: documentation that describes last quarter's API; generated clients built from a stale spec.
  Applies: projects with an OpenAPI/Swagger, JSON Schema, Postman collection or similar artifact. Every endpoint gets at least one request and one response example.
  Exception: the project has no spec; then the report says so and documents the endpoint where the project documents others (README, docstring, route comment).
  Verify: the spec diff is in the same change set; a spec linter or contract test, if present, passes.

### CONSIDER

- **Adopting RFC 9457 problem details** (`application/problem+json` with `type`, `title`, `status`, `detail`, plus an `errors` array for fields) when the project has no established error shape yet.
- **Cursor pagination over offset** for large or frequently changing collections (stable under inserts, cheap at depth); offset when clients need "jump to page 7" and the table is small.
- **Policy for `404` versus `403` on resources the caller may not see.** Either is defensible; the same choice must apply across the API so existence is not leaked by inconsistency.
- **Sending `Deprecation` and `Sunset` headers** on deprecated endpoints when the project's clients can observe headers; otherwise rely on the spec and changelog.

## Workflow

- **Understand:** read three existing endpoints of the same kind (one list, one create, one error path) before designing. Record the conventions found: path style, envelope, error shape, pagination parameters, auth mechanism, ID and date formats, where the spec lives. Find who calls the endpoint you are about to change.
- **Plan:** write the contract first: method, path, request, success response, error responses, auth rule, pagination. Name the sibling endpoint it mirrors. If the change touches an existing contract, list consumers and the migration path here. Ask when the project has two conflicting conventions.
- **Implement:** build the contract exactly as planned; validation and authorization in the same place siblings do them; update the spec and examples in the same change.
- **Verify:** run the project's API tests and contract or spec checks. Exercise, by test or request, the success path, one validation failure, one authorization failure (another user's resource) and, for lists, the pagination bounds. Confirm the error body matches a sibling's.
- **Report:** the contract (method, path, shapes), the sibling it mirrors, consumers affected and their migration, what was verified with actual commands and results, and any convention deviation with its reason.

## Examples

**Request:** "Return a proper error when the invoice is not found."

Existing endpoints in the project respond to failures with:

```json
{ "error": { "code": "not_found", "message": "Customer 42 not found" } }
```

Inconsistent (a new shape for one endpoint):

```json
HTTP 200
{ "success": false, "msg": "Invoice not found", "trace": "at InvoiceRepo.find (repo.js:88)" }
```

Consistent:

```json
HTTP 404
{ "error": { "code": "not_found", "message": "Invoice 17 not found" } }
```

**Request:** "Rename `amount` to `total_amount` on the order response, it is clearer."

Breaking: rename the field in place. The mobile app and the finance export
job both read `amount`.

Additive: add `total_amount` alongside `amount`, mark `amount` deprecated in
the OpenAPI document with a removal version, notify the two consumers, remove
`amount` in the release after both have migrated. The report lists both
consumers and the removal condition.

A full scenario: [examples/api-design/customer-invoices-endpoint.md](../../examples/api-design/customer-invoices-endpoint.md).

## Anti-patterns

- **200 for everything.** Every response is `200` and the client inspects a `success` flag. Correction: use the status code; keep the body shape the project uses for errors.
- **Verb soup paths.** `POST /getInvoices`, `GET /invoice/delete/5`, `POST /updateCustomerAddress`. Correction: nouns in the path, the verb in the method; an action segment only for a non-CRUD operation.
- **Silent breaking change.** Renaming a field, changing a type, or tightening validation on a live endpoint because "it is cleaner". Correction: additive change plus deprecation, with consumers listed.
- **Pagination by accident.** A list endpoint that returns all rows because the test fixture had six. Correction: default and maximum page size, pagination metadata matching sibling endpoints.
- **Textbook over project.** Introducing RFC 9457 problem details, HAL links or `/v2/` into an API that has its own working conventions. Correction: the project's convention wins; propose a migration separately if it is genuinely better.
- **Authenticated is not authorized.** Checking for a valid token and then loading any ID the caller asks for. Correction: scope queries by the caller; check ownership or policy on item endpoints; test with another user's token.
- **Leaky errors.** Exception messages, stack traces, SQL or upstream bodies forwarded to the client. Correction: map internal failures to the project's error shape with a generic message and a logged correlation ID.
- **Version reflex.** Creating `v2` because a field was added. Correction: additive changes need no version; version only when the old and new semantics cannot share a path.

## Verification checklist

- [ ] Three sibling endpoints were read and their conventions listed before designing.
- [ ] The new endpoint matches those conventions: path style, envelope, error shape, pagination, auth, formats.
- [ ] Methods and status codes are semantically correct; no `GET` with side effects; no error under `200`.
- [ ] Error responses use the project's single shape and leak no internals.
- [ ] Authentication is enforced and authorization is checked per object; an other-user test exists or was run.
- [ ] Input is validated at the boundary with the project's `400`/`422` convention; unknown-field policy matches siblings.
- [ ] Lists are paginated with bounded page size and the project's metadata.
- [ ] Any change to an existing contract is additive, or consumers and a migration path are listed.
- [ ] The spec and examples were updated in the same change, or the project has no spec and the report says so.
- [ ] API tests and contract or spec checks were run; actual results are in the report.

## Output

The report states the contract (method, path, request and response shapes,
error responses, auth rule, pagination), names the existing endpoint it was
modelled on, lists every consumer affected by a contract change with its
migration path (or states "additive, no consumer impact"), and gives the
verification commands with their actual results. It must not describe an
endpoint as "RESTful" or "backward compatible" without the specifics above,
must not claim the spec is updated when it is not, and must flag any place
where it followed a project convention that contradicts HTTP semantics.
