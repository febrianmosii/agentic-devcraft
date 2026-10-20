# HTTP semantics cheat sheet

Apply these when the project has no established convention. When it has
one, the project wins and the report notes the deviation.

## Methods

| Method | Safe | Idempotent | Typical use | Common mistake |
|---|---|---|---|---|
| `GET` | yes | yes | read a resource or collection | side effects (mark as read, increment counter) |
| `HEAD` | yes | yes | metadata only | forgotten when `GET` is customised |
| `POST` | no | no | create; non-CRUD action; search with large criteria | used for reads because the URL got long |
| `PUT` | no | yes | full replace of a resource at a known URL | partial update that silently nulls omitted fields |
| `PATCH` | no | no* | partial update | treated as idempotent when it applies deltas (`+1`) |
| `DELETE` | no | yes | remove | returning `404` on the second call when clients retry (`204` or `404` are both defensible; pick one across the API) |

\* `PATCH` is idempotent when the patch sets absolute values, not when it
applies relative ones. Say which in the spec.

Safe means a client, proxy or crawler may issue it freely. Idempotent means
a retry after a timeout is harmless. Both matter for retry logic and caching,
not just for style.

## Status codes

### Success

| Code | Use | Body |
|---|---|---|
| `200` | read, update, action with a result | the resource or result |
| `201` | created | the new resource; set `Location` to its URL |
| `202` | accepted for asynchronous processing | a status URL or job ID |
| `204` | success with nothing to return (delete, some updates) | none |

### Client errors (the caller can fix the request)

| Code | Use |
|---|---|
| `400` | malformed request: invalid JSON, wrong type, missing required field |
| `401` | no credentials or invalid credentials; include `WWW-Authenticate` |
| `403` | valid credentials, not permitted |
| `404` | no such resource; also used for "not permitted to know it exists" under a stated policy |
| `405` | method not supported on this path; include `Allow` |
| `409` | state conflict: duplicate unique key, version mismatch, "already shipped" |
| `410` | existed, removed on purpose (deprecated endpoint after sunset) |
| `412` / `428` | conditional request failed / precondition required (optimistic locking with `If-Match`) |
| `415` | unsupported `Content-Type` |
| `422` | well-formed but semantically invalid (business rule failed) |
| `429` | rate limited; include `Retry-After` |

`400` versus `422`: many projects use `400` for both or `422` for all
validation. The split is less important than consistency; use what sibling
endpoints use and document it.

### Server errors (the caller cannot fix the request)

| Code | Use |
|---|---|
| `500` | unexpected failure; log it with a correlation ID; return the generic error shape |
| `502` / `504` | an upstream the server depends on failed or timed out |
| `503` | deliberately unavailable (maintenance, overload); include `Retry-After` |

Never return `5xx` for a caller's mistake, and never return `4xx` for a
server bug. Monitoring and retry policies depend on this line.

## Headers worth getting right

- `Location` on `201` and on `202` (status URL).
- `Content-Type: application/json; charset=utf-8` on every JSON body,
  including errors.
- `ETag` / `If-Match` when concurrent updates to the same resource are
  plausible; return `412` on mismatch.
- `Retry-After` on `429` and `503`.
- `Allow` on `405`.
- `Deprecation` / `Sunset` on deprecated endpoints when the project's
  clients can observe headers.
- `Cache-Control: no-store` on responses containing personal or financial
  data unless caching is intended.

## Error body

One shape for the whole API. A minimal, project-neutral version:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request is invalid",
    "fields": [
      { "field": "email", "code": "invalid_format", "message": "Must be an email address" }
    ]
  }
}
```

RFC 9457 equivalent (`Content-Type: application/problem+json`):

```json
{
  "type": "https://example.com/problems/validation-failed",
  "title": "Request is invalid",
  "status": 422,
  "detail": "One or more fields failed validation",
  "errors": [
    { "pointer": "/email", "detail": "Must be an email address" }
  ]
}
```

Rules that hold for either:

- `code` (or `type`) is stable and machine-readable; `message` (or
  `detail`) may change wording without notice.
- No stack traces, SQL, file paths, class names, or upstream response
  bodies. Log those server-side with a correlation ID and, if the project
  does so, return the ID in the body or a header.
- Validation errors list every failing field in one response, not the
  first one found.

## Quick self-check for a new endpoint

1. Does a `GET` change anything? If yes, it is a `POST`.
2. Does a retry of this request after a timeout do damage? If yes, it needs
   an idempotency key or `If-Match`.
3. Is any error returned as `200`? Fix it.
4. Is any caller mistake returned as `500`? Fix it.
5. Does the error body match a sibling endpoint's exactly in structure?
6. Does `201` carry `Location` or the created resource?
