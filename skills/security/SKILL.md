---
name: security
description: >-
  Applies secure-by-default engineering to code an agent writes or reviews:
  validates input at trust boundaries, enforces authentication and object-level
  authorization on every request, keeps secrets out of code and logs, prevents
  injection (SQL, command, template, path traversal), hardens configuration and
  dependencies, and blocks the common web vulnerabilities (XSS, CSRF, SSRF, mass
  assignment, insecure deserialization, open redirects, unsafe file upload). Use
  when adding or changing an endpoint, form, query, file download or upload,
  login or session code, a config or CORS setting, a dependency, or when asked
  to "make it secure", "security review", "audit", "fix the vulnerability",
  "pentest finding", "OWASP", or to handle passwords, tokens or API keys.
license: MIT
metadata:
  collection: agentic-devcraft
  version: "0.1.0"
---

# Security

## Purpose

Agents write the vulnerable version first because it is shorter: the query
with string interpolation, the download handler that trusts the path in the
URL, the `findById` with no owner check, the `cors: "*"` that made the browser
stop complaining. Then they report the feature as "secure" without having
checked anything. This skill makes the agent treat every input as hostile
until validated, every request as unauthorised until checked, every secret as
leaked if it touches code or logs, and makes the report state exactly which
controls exist and which checks actually ran.

## When to use

- Adding or changing an HTTP endpoint, GraphQL resolver, CLI argument, webhook,
  queue consumer or any other entry point that receives external data.
- Writing database queries, shell invocations, file-system access, template
  rendering or outbound HTTP calls that include user-influenced values.
- Login, logout, password reset, session, token, API key or permission code.
- Configuration touching TLS, CORS, cookies, headers, debug mode or
  environment variables.
- Adding or upgrading a dependency.
- Reviewing a diff or an existing module for vulnerabilities, or responding to
  a pentest or scanner finding.

Not needed for pure refactors of code with no external input and no
privilege, but re-check the moment such code gains a caller that has either.

## Rules

Levels: **MUST** (no deviation without a documented exception), **SHOULD**
(deviate with a one-sentence reason), **CONSIDER** (judgment call).

### MUST

- **Validate every input at the trust boundary, server-side, against an allowlist.**
  Prevents: injection, type confusion, path traversal and logic bypass from values the client controls (body, query, headers, cookies, path, file names, webhook payloads).
  Applies: every entry point; client-side validation is UX, not a control.
  Exception: data produced by your own trusted code in the same process and never influenced by a client.
  Verify: each field has a declared type, length and format or enum; unknown fields are rejected or dropped; a request with a malformed value gets a 4xx and never reaches the query, shell or file system.

- **Authenticate and authorise on every request, including object-level ownership.**
  Prevents: IDOR (`/invoices/123` served to anyone who guesses 123), privilege escalation, and endpoints that are protected only because the UI hides the link.
  Applies: every route, resolver, job trigger and admin action; both the "can this user call this?" and "can this user touch *this* record?" questions.
  Exception: endpoints documented as public, listed as such in the report.
  Verify: the handler or its middleware rejects an unauthenticated request with 401 and a cross-tenant id with 403 or 404; a test exercises the cross-tenant case; lookups are scoped (`where owner_id = :user`), not filtered after the fetch.

- **Keep secrets out of source, commits, logs and error output.**
  Prevents: credential leakage via repository history, log aggregation, stack traces and crash reporters.
  Applies: API keys, passwords, tokens, private keys, connection strings, signing secrets, including in tests, fixtures, examples and CI configuration.
  Exception: clearly fake placeholders in `.env.example` and documentation (`sk_test_PLACEHOLDER`).
  Verify: `git grep -nE "(api[_-]?key|secret|password|token)\s*[=:]\s*['\"][^'\"]{8,}"` returns only placeholders; secrets are read from the environment or a secret store; log statements and exception messages are checked for secret-bearing fields. If a secret was ever committed, treat it as exposed and say so: rotation is required, history rewriting is not a substitute.

- **Never build a query, command, template or path from user-influenced strings.**
  Prevents: SQL/NoSQL injection, shell command injection, server-side template injection, LDAP injection, path traversal.
  Applies: any value that reaches `execute`, `raw`, `exec`, `spawn`, `render_template_string`, `eval`, `open`, `readFile`, or an LDAP filter.
  Exception: identifiers (table or column names) that cannot be parameterised, if mapped through a hardcoded allowlist first.
  Verify: queries use bound parameters or the ORM's query builder; commands use argument arrays with no shell; templates receive data, not template source; file paths are built from an allowlisted base plus a validated name and checked to resolve inside the base. See [references/web-vulnerability-checklist.md](references/web-vulnerability-checklist.md).

- **Use the platform's vetted primitives for crypto, hashing and sessions.**
  Prevents: home-made password hashing, hand-rolled token comparison vulnerable to timing attacks, predictable session ids, reversible "encryption" of passwords.
  Applies: password storage, token generation and comparison, encryption at rest, signing, session management.
  Exception: none; if the platform lacks a primitive, pick a maintained library and record the choice.
  Verify: passwords use argon2id, scrypt or bcrypt with the library's default cost or higher; tokens come from a CSPRNG (`crypto.randomBytes`, `secrets.token_urlsafe`, `random_bytes`) and are compared with a constant-time function; sessions are regenerated on login and invalidated on logout and password change; cookies carry `HttpOnly`, `Secure`, `SameSite`.

- **Never claim a scan, audit or test ran unless it ran, and never weaken a control to make something work.**
  Prevents: false assurance in reports, and "fixes" such as disabling CSRF, setting CORS to `*`, turning off certificate verification or catching the authorisation exception.
  Applies: every report; every change to a security-relevant setting or check.
  Exception: none. A control may change only when the task is to change it, and the report names the control and the new exposure.
  Verify: the report quotes the actual command and result (`npm audit`, `composer audit`, `pip-audit`, `semgrep`, the test file) or states "not run"; `git diff` shows no removed or loosened check that the request did not ask for.

### SHOULD

- **Fail closed and return generic errors to the client.**
  Prevents: authorisation code that grants access when a lookup throws, and error pages that leak stack traces, SQL or internal paths.
  Applies: authorisation checks, exception handlers, debug settings.
  Exception: a documented internal tool where verbose errors are intentional and the network boundary is stated.
  Verify: an exception in the permission check yields a denial; `APP_DEBUG`, `DEBUG`, `NODE_ENV` and equivalents are off in production configuration; the client sees an error id, the log sees the detail.

- **Ship a hardened configuration, not the framework scaffold.**
  Prevents: permissive CORS, missing security headers, cleartext cookies, default credentials and TLS verification left disabled from development.
  Applies: new services, deployment configs, reverse-proxy and framework settings.
  Exception: a local-only development profile that is clearly separated from production.
  Verify: CORS lists explicit origins; responses carry `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` and a frame policy; TLS 1.2+ with verification on; no default accounts remain. See [references/secrets-and-config.md](references/secrets-and-config.md).

- **Treat dependencies as code you are shipping.**
  Prevents: typosquatted or abandoned packages, floating versions that change under you, known CVEs sitting in the lockfile.
  Applies: adding, upgrading or removing any package.
  Exception: none for the audit; pinning can be relaxed when the project deliberately uses ranges and a lockfile is committed.
  Verify: the lockfile is committed and changed in the same commit as the manifest; the package was checked for maintenance, download pattern and source repository before adding; the ecosystem's audit command ran and its output is in the report.

- **Bind request bodies to explicit fields, never to whole models.**
  Prevents: mass assignment (`is_admin: true`, `price: 0` in a profile update).
  Applies: ORM `create`/`update`/`fill` from request data, DTO mapping, GraphQL input types.
  Exception: none; an allowlist of one field is still an allowlist.
  Verify: the handler names the writable fields (`$request->only([...])`, `$fillable`, a schema, a DTO) and privileged fields such as role, owner, balance and status are set by server code only.

- **Encode output for the context it lands in.**
  Prevents: reflected and stored XSS, header injection, log forging.
  Applies: HTML templates, JSON embedded in HTML, URLs built from data, response headers, log lines containing user input.
  Exception: content from a sanitiser configured for the exact allowed markup, with the sanitiser named in the report.
  Verify: templates use auto-escaping (`{{ }}`, not `{!! !!}` / `|safe` / `dangerouslySetInnerHTML`) unless the value passed through a named sanitiser; CSP is present as a second layer; newlines are stripped from header values.

### CONSIDER

- **Rate limiting and lockout** on authentication, password reset, OTP and other endpoints where guessing is cheap.
- **A static analysis pass** (`semgrep --config p/owasp-top-ten`, `bandit`, `gosec`, `brakeman`, `psalm --taint-analysis`) when the project has none, reported as a suggestion with its output rather than silently added to CI.
- **Serving uploaded files from a separate origin or storage bucket** with a server-chosen name and `Content-Disposition: attachment`, instead of from the application's web root.
- **An abuse case per feature** written next to the happy-path test: "what does an attacker send here, and what should happen?"

## Workflow

- **Understand:** draw the trust boundary for the change: which values originate outside the process, which identity makes the request, which resources it may touch. Read how the project already does authentication, validation, queries and configuration; reuse those mechanisms. Check whether a scanner, audit command or security test already exists.
- **Plan:** for each input, name its validation; for each resource access, name the authorisation check; for each sink (query, shell, file, template, outbound request), name the safe API. Name the controls you will not add and why.
- **Implement:** use the framework's guard, validator, query builder, escaping and crypto primitives. Write the negative test (wrong user, malformed id, traversal name) alongside the positive one.
- **Verify:** run the tests including the negative cases; run the ecosystem's audit command if a dependency changed; grep the diff for raw sinks and for secrets; review `git diff` for any loosened control.
- **Report:** list controls added (validation, authz, encoding, headers), exposures accepted (public endpoints, ranges, `unsafe` blocks), checks run with actual output, checks not run, and anything noticed outside the task (an existing endpoint with no authz, a committed key).

## Examples

**Request:** "Add `GET /invoices/{id}/download` so customers can fetch their invoice PDF."

Before: the id selects any invoice, the file name in the row is trusted, and the handler is reachable without ownership.

```php
public function download(Request $request, int $id)
{
    $invoice = Invoice::findOrFail($id);
    return response()->download(storage_path('invoices/' . $invoice->file));
}
```

After: lookup scoped to the authenticated customer, path built from a validated name inside a fixed directory, resolved path checked against the base.

```php
public function download(Request $request, int $id)
{
    $invoice = Invoice::where('customer_id', $request->user()->customer_id)
        ->findOrFail($id);                                   // 404 for other tenants

    abort_unless(preg_match('/^[A-Za-z0-9_-]+\.pdf$/', $invoice->file), 500);
    $base = realpath(storage_path('app/invoices'));
    $path = realpath($base . DIRECTORY_SEPARATOR . $invoice->file);
    abort_unless($path !== false && str_starts_with($path, $base . DIRECTORY_SEPARATOR), 404);

    return response()->download($path, "invoice-{$invoice->number}.pdf", [
        'Content-Type' => 'application/pdf',
    ]);
}
```

Test added: user A requests user B's invoice id and receives 404; a row whose
`file` is `../../.env` receives 500 and no file. Report fragment: "Route is
behind `auth` middleware and scoped by `customer_id`. Ran
`php artisan test --filter=InvoiceDownload` (3 passed). `composer audit`: not
run, no dependency changed. Noticed, not changed: `GET /invoices/{id}` (view)
has no `customer_id` scope either."

Full scenario: [examples/security/invoice-download-idor.md](../../examples/security/invoice-download-idor.md).

## Anti-patterns

- **UI-gated authorisation.** The button is hidden for non-admins, so the endpoint "is protected". Correction: enforce in middleware or the handler; test by calling the route directly as the wrong user.
- **Filter-after-fetch.** `findById(id)` then `if (record.owner !== user) throw`. Correction: scope the query; the record must be unreachable, not merely rejected, so a missed branch cannot leak it.
- **Sanitise-by-blocklist.** Stripping `../`, `<script>` or `;` from input. Correction: validate against an allowlist of what the value may be; use parameterised sinks so the sink is safe regardless.
- **"Temporarily" disabled control.** `verify=False`, `csrf: false`, `origin: "*"`, `@csrf_exempt`, a commented-out permission check to get a test or integration going. Correction: fix the actual mismatch (certificate, origin list, token flow); never leave a loosened control in the diff.
- **Secret in the fix.** Pasting a real token into a test fixture, a Dockerfile `ENV`, a CI YAML or a debug log line. Correction: read from the environment; if a real value was committed, report it as exposed and requiring rotation.
- **Custom crypto.** `md5(password + salt)`, a hand-rolled token with `Math.random()`, comparing HMACs with `==`. Correction: argon2id/bcrypt via the platform, CSPRNG tokens, constant-time comparison.
- **Trusting the file.** Accepting an upload because the extension or client `Content-Type` says `image/png`, storing it under the original name in the web root. Correction: check magic bytes, enforce size, generate the stored name, serve with `nosniff` and `attachment`.
- **Phantom audit.** Reporting "ran a security review, no issues found" when the review was reading the code once. Correction: name what ran (`semgrep`, `npm audit`, specific tests) and what did not; a manual read is "reviewed by inspection", not "scanned".

## Verification checklist

- [ ] Every external input in the diff has server-side validation with declared type, bounds and format.
- [ ] Every route or handler in the diff has authentication and an object-level ownership check, or is listed as public in the report.
- [ ] No query, command, template or file path is built from user-influenced strings; sinks use parameters, argument arrays or allowlisted bases.
- [ ] Output is escaped for its context; no new `raw`/`unsafe`/`dangerouslySetInnerHTML` without a named sanitiser.
- [ ] Request bodies bind to an explicit field list; privileged fields are server-set.
- [ ] Passwords, tokens, sessions and signatures use platform primitives; cookies have `HttpOnly`, `Secure`, `SameSite`.
- [ ] `git grep` for secret patterns in the diff returns only placeholders; no secret appears in logs or error output.
- [ ] Dependency changes come with a lockfile change and the audit command's actual output.
- [ ] No existing control (CSRF, CORS, TLS verification, authz, debug flag) was loosened unless the task asked for it and the report says so.
- [ ] Negative tests (wrong user, malformed input, traversal name, oversized upload) exist and were run; results are in the report.

## Output

The report lists the controls present in the change (validation, authz,
encoding, headers, crypto primitives), the exposures deliberately accepted
(public routes, accepted ranges, named sanitisers), the exact commands run
with their results, and the checks that were not run. It names any secret
found in history as exposed and requiring rotation. It never describes code as
"secure" or "audited" without naming the control or the tool, never hides a
weakened control inside a feature change, and never reports a scan, audit or
test that did not execute.
