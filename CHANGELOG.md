# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

The three planned releases below are the roadmap. All ten skills exist in
the repository today and validate; the tags mark the point at which each
group is considered reviewed and stable.

## [Unreleased]

### Added

- Validator (`scripts/validate-skills.mjs`): spec frontmatter checks,
  required sections, link and orphan-reference checks, example structure,
  compatibility-claim guard. Zero dependencies.
- Test suite with `node:test`, including a self-check that the repository
  validates cleanly.
- GitHub Actions CI running tests and validation on Node 20 and 22.
- Documentation: authoring contract, agent workflow, validation reference,
  compatibility matrix.
- Issue templates (bug, rule proposal, compatibility report) and a pull
  request template.

## [0.1.0] — Foundation (planned)

### Added

- `scope-control`: task boundaries, minimal diffs, preserved behaviour,
  explicit out-of-scope reporting.
- `architecture`: abstraction only for present need, separation of
  concerns, structure consistency, recorded trade-offs.
- `clean-code`: naming, readability, explicit error handling, DRY without
  premature abstraction, no unrelated restyling.

## [0.2.0] — Reliability (planned)

### Added

- `security`: input validation, authentication and authorization, secrets,
  injection prevention, secure configuration, dependencies, common web
  vulnerabilities.
- `testing`: unit, integration and end-to-end testing, edge cases,
  isolation, meaningful assertions, no fabricated results.
- `production-readiness`: configuration, build and test verification,
  security checks, logging, deployment risks, honest completion reporting.

## [0.3.0] — Engineering excellence (planned)

### Added

- `performance`: measurement before and after, algorithms, query
  optimization, caching, frontend, memory.
- `database`: schema design, indexing, query efficiency, transactions,
  integrity, migration safety, ORM practices, N+1.
- `api-design`: resource naming, HTTP semantics, error consistency,
  validation, pagination, versioning, backward compatibility, idempotency.
- `accessibility`: semantic HTML, keyboard, focus management, contrast,
  forms, screen readers, responsive interaction.

[Unreleased]: https://github.com/febrianmosii/agentic-devcraft/compare/main...HEAD
[0.1.0]: https://github.com/febrianmosii/agentic-devcraft/releases/tag/v0.1.0
[0.2.0]: https://github.com/febrianmosii/agentic-devcraft/releases/tag/v0.2.0
[0.3.0]: https://github.com/febrianmosii/agentic-devcraft/releases/tag/v0.3.0
