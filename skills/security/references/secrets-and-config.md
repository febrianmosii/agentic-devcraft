# Secrets and secure configuration

## Where secrets may live

| Allowed | Not allowed |
|---|---|
| Environment variables injected by the platform or orchestrator | Source files, including tests, fixtures and seeders |
| A secret store (Vault, AWS Secrets Manager, GCP Secret Manager, SOPS-encrypted files, platform secrets in CI) | Committed `.env`, `config/*.php`, `settings.py`, `application.yml` with real values |
| A local `.env` listed in `.gitignore` | Dockerfile `ENV`/`ARG`, docker-compose files, Helm values committed in plain text |
| CI secret variables referenced by name | CI YAML with literal values; build logs; `echo $SECRET` for debugging |
| Placeholders in `.env.example` and docs (`CHANGE_ME`, `sk_test_PLACEHOLDER`) | Log lines, exception messages, crash reports, APM payloads, HTTP responses |

Rules of thumb:

- Read secrets once at startup through the project's config layer; do not call
  `getenv` from random modules. In Laravel, `env()` belongs in `config/*.php`
  only; application code reads `config()`.
- Do not print the whole config, request or user object in a log statement.
  Redact fields named `password`, `token`, `secret`, `authorization`, `cookie`,
  `api_key` at the logger level if the project has that facility.
- Compare secrets with a constant-time function; never with `==` or string
  equality on an HMAC.

## If a secret was committed

Treat it as exposed from the moment it entered any shared history, even a
private repository or a branch that was never merged.

1. Rotate it at the provider first (new key issued, old key revoked). Do this
   before anything else; history rewriting does not un-leak a value.
2. Replace the literal in code with a config/environment read.
3. Add the file pattern to `.gitignore` if it was a config file.
4. Only then consider rewriting history (`git filter-repo`), and only with the
   owner's agreement, since it rewrites every collaborator's clone.
5. Report: which secret, where it appeared, that rotation is required or was
   done, and who did it.

Never report "removed the secret from the code" as if that closed the
exposure.

## Production configuration baseline

Check these in the deployed configuration, not only in the framework
defaults. Several frameworks ship development-friendly values.

| Area | Setting | Verify |
|---|---|---|
| Debug | `APP_DEBUG=false`, `DEBUG=False`, `NODE_ENV=production`, Spring `server.error.include-stacktrace=never` | An unhandled exception returns a generic page or JSON with an error id, no trace |
| TLS | TLS 1.2 minimum, verification on for outbound calls, HSTS with `max-age` of at least six months once stable | No `verify=False`, `rejectUnauthorized: false`, `CURLOPT_SSL_VERIFYPEER => false`, `InsecureSkipVerify: true` outside a clearly local profile |
| Cookies | `Secure`, `HttpOnly`, `SameSite=Lax` or `Strict`; session lifetime bounded | Inspect `Set-Cookie` on a login response |
| CORS | Explicit origin list; `credentials: true` never combined with `*` or a reflected `Origin`; minimal methods and headers | Preflight from an unlisted origin is rejected |
| Security headers | `Content-Security-Policy` (start with `default-src 'self'` and add sources deliberately), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` or CSP `frame-ancestors`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` for unused features | `curl -sI https://host/ \| grep -iE "content-security|nosniff|frame|referrer|strict-transport"` |
| Session | Regenerated on login and privilege change; server-side store or signed tokens; idle and absolute timeouts | Session id before and after login differ; logout invalidates server-side |
| Error pages | Framework default error pages replaced or stack traces disabled | Request a non-existent route and a route that throws |
| Default accounts | No seeded admin with a known password; no default database or admin-panel credentials | Seeders only create privileged users in non-production environments, or generate a random password printed once |
| File permissions | Config and key files not world-readable; uploads directory not executable | `ls -l` on `.env`, private keys, upload root |
| Database | Application user has only the grants it needs; no `root`/`sa` in the connection string; network access limited to the app hosts | `SHOW GRANTS` for the app user; firewall or security group rules |
| Dependencies | Lockfile committed; audit command in CI or run before release; pinned base images in Dockerfiles | `npm audit`, `composer audit`, `pip-audit`, `cargo audit`, `govulncheck ./...`, `bundle audit` output |

## Dependency vetting before adding a package

Spend two minutes before `npm install` / `composer require` / `pip install`:

- Does the project already have a package that does this? Prefer it.
- Does the exact name match the intended package (typosquats differ by one
  character)? Open the registry page from the repository link, not a search.
- When was the last release and does the repository respond to issues?
- Does it pull in native builds, postinstall scripts or an unusual number of
  transitive dependencies?
- Is the license compatible with the project?

Record the answers in the report in one or two sentences. If the audit
command reports a vulnerability in a transitive dependency with no fix, say
so and state the exposure rather than suppressing the advisory.
