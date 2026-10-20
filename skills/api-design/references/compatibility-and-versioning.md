# Compatibility, deprecation, versioning and idempotency

Use this when a change touches an endpoint that something already calls.
"Something" includes mobile apps that users update months late, partner
integrations, cron jobs, other internal services, cached responses and
generated client SDKs.

## What counts as breaking

Breaking (needs consumers listed and a migration path):

- Removing or renaming a field, parameter, header, enum value or endpoint.
- Changing a field's type, format or nullability (`"42"` to `42`, ISO date
  to epoch, nullable to required).
- Changing the meaning of a field or the default of a parameter.
- Tightening validation: a request that used to succeed now fails.
- Changing a status code for an existing case (`200` to `204`, `400` to
  `422`).
- Changing the error shape.
- Requiring authentication or a new scope on an endpoint that did not.
- Changing pagination behaviour (default size, ordering, cursor format).
- Reordering or changing the shape of items in an array that clients index
  by position.
- Changing URL structure, even with a redirect, for non-browser clients.

Additive (safe by default, no new version needed):

- New optional field in a response.
- New optional parameter with a default that preserves current behaviour.
- New endpoint.
- New enum value, only if consumers are documented to tolerate unknown
  values; otherwise treat it as breaking.
- Loosening validation (accepting more than before).
- New error `code` under the existing shape, for a new failure case.

Grey area, decide per project: adding a required field to a request body is
breaking for existing senders; adding a field to a webhook payload is
additive unless the receiver verifies a signature over a fixed field list.

## Finding consumers

Do this before planning any breaking change, and put the result in the plan:

1. `grep` the monorepo or known client repositories for the path and for the
   field names.
2. Check the API gateway, access logs or analytics for the endpoint's
   callers (user agents, API keys, client IDs) over a window long enough to
   catch monthly jobs.
3. Read the spec's changelog and any client SDKs generated from it.
4. Ask the owner of each external consumer if one is known.

"I could not find any consumers" is a finding to report, not a licence to
break.

## Deprecation procedure

1. Ship the replacement (new field, parameter or endpoint) while the old one
   keeps working unchanged.
2. Mark the old one deprecated where the project documents its API
   (`deprecated: true` in OpenAPI, a changelog entry, a docstring). State the
   removal version or date.
3. If the project's clients can observe headers, send `Deprecation: true`
   (or the date form) and `Sunset: <HTTP-date>` on responses that use the
   deprecated element.
4. Notify known consumers with the migration instruction.
5. Log usage of the deprecated element so removal can be timed.
6. Remove after the announced period and after logs show no traffic, or
   after every known consumer has confirmed migration. Return `410 Gone`
   for a removed endpoint if the project does that elsewhere.

Security fixes may skip the waiting period; the report must say so.

## When versioning is justified

A new API version is for semantic changes that cannot coexist with the old
behaviour under the same identifiers: a resource that means something
different, an auth model change, a restructured error contract for the
whole API. It is not for field additions, new endpoints or wording changes.

If a version is needed, use the strategy the project already uses. If none
exists, pick one and document it:

| Strategy | Example | Trade-off |
|---|---|---|
| URL prefix | `/v2/invoices` | visible, cacheable, easy to route; duplicates paths |
| Header | `Accept: application/vnd.example.v2+json` | clean URLs; invisible in logs and browser testing |
| Query parameter | `/invoices?version=2` | simple; easy to forget, pollutes caching keys |
| Date-based | `X-API-Version: 2026-10-01` | fine-grained opt-in; needs a translation layer per date |

Whatever the strategy, each version is a maintained product: tests, docs and
a sunset plan. Two live versions is normal; five is a warning sign.

## Idempotency keys

For `POST` operations whose duplicate execution has a cost (payments,
orders, outbound messages, provisioning):

- Accept an `Idempotency-Key` header (or the project's existing name).
  Clients generate a UUID per logical operation and reuse it on retry.
- Scope the key to the authenticated principal plus the endpoint; the same
  key from a different caller is a different operation.
- Store the key with the request fingerprint (hash of method, path, body),
  the final status code and the response body, with a retention period
  (24 hours is a common choice).
- On a repeat: same key and same fingerprint returns the stored response
  with the original status; same key with a different fingerprint returns
  `422` (or the project's conflict code) with a clear error `code`.
- While the first request is still in flight, a concurrent repeat returns
  `409` rather than executing twice. Use a database lock or unique
  constraint on the key, not an in-memory check.
- Do not store keys for failed validation (`4xx` before side effects);
  storing `5xx` outcomes is a project decision; document it.

Webhook receivers apply the same idea with the provider's event ID: record
processed IDs with a unique constraint, acknowledge duplicates with the same
success code, process each event once.

`PUT` is idempotent by definition when it carries the full representation.
A `PUT` that applies a partial update is a `PATCH` with the wrong name and
loses the retry guarantee; fix the method or the semantics.
