# AGENTS.md — CatalogGuard operating instructions

This file exists so a new chat, coding agent, or maintainer can resume CatalogGuard without reconstructing prior discussion.

## Mandatory first steps

Before making consequential changes:

1. Read `README.md`.
2. Read `PROJECT_BASELINE.md`.
3. Read `docs/DECISION_LOG.md`.
4. Read `docs/HANDOFF.md`.
5. Inspect current `main` HEAD SHA.
6. Inspect open PRs and issues.
7. Inspect relevant GitHub Actions status.
8. Re-verify Shopify platform assumptions if they are time-sensitive.

Do not infer an approved baseline from the nearest commit. If the user has explicitly approved a state, identify the exact SHA and what was approved.

## Project objective

Build a low-overhead, commercially viable Shopify public app that provides merchant-defined catalog policy, deterministic validation, baseline/regression classification, exceptions, and preflight QA.

The core product promise is **catalog governance and regression protection**, not generic store scoring.

## Locked product boundaries unless explicitly changed

V1 should be predominantly read-only.

Do not opportunistically add:

- AI copy/image generation
- theme modifications
- order/customer analytics
- ad management
- a PIM
- a 3PL integration
- generic workflow automation
- destructive auto-fixes
- broad write scopes

Do not claim CatalogGuard can universally intercept or block every Shopify native product save/publish operation unless that capability is specifically verified against the current Shopify platform.

## Engineering rules

- Use Shopify GraphQL Admin API for new public-app functionality.
- Baseline API version is `2026-07`; upgrade only deliberately and test breaking changes.
- Use Shopify's currently recommended React Router template unless a documented decision changes this.
- Minimize access scopes.
- Avoid protected customer data by design.
- Keep rule evaluation deterministic.
- Treat `UNKNOWN`/unavailable data separately from `PASS`.
- Make webhook processing idempotent.
- Use webhooks for incremental detection plus full reconciliation for correctness.
- Preserve policy-version and scan-version evidence so historical results remain explainable.
- Do not make a passing preflight depend on mutable rule configuration without recording the exact policy revision evaluated.

## Change-control rules

For bug fixes:

1. Observe the actual failure.
2. Identify the first incorrect layer.
3. Form one hypothesis.
4. Design the smallest test.
5. Make the smallest necessary change.
6. Re-run the affected tests.
7. Re-run broader quality gates if the change can affect other rules, scans, webhooks, or migrations.
8. Revert failed experiments before trying another hypothesis.

Do not refactor unrelated working code during a focused fix.

## Data/UI separation

When a displayed finding is wrong, trace:

```text
Shopify source
-> GraphQL selection / webhook payload
-> normalization
-> stored snapshot
-> rule input
-> rule evaluation
-> finding lifecycle
-> API/loader mapping
-> UI rendering
```

Fix the first incorrect layer. Do not hide upstream errors with presentation logic.

## Completion evidence

A code change is not complete merely because it was committed.

Depending on scope, completion may require:

- unit tests
- rule contract tests
- fixture tests
- DB migration test
- webhook signature/idempotency test
- GraphQL integration test against a Shopify dev store
- full scan result verification
- incremental change verification
- regression/resolution/exception lifecycle verification
- preflight pass/fail verification
- Admin UI extension verification
- CI status
- deployment evidence

Use `docs/QUALITY_AND_RELEASE.md` as the governing checklist.

## Documentation obligations

Update documentation when a change alters:

- product scope
- data model
- rule semantics
- access scopes
- API version
- deployment architecture
- billing/pricing
- quality gates
- App Store assumptions
- commercial positioning

Material decisions belong in `docs/DECISION_LOG.md`.

Current-state handoff belongs in `docs/HANDOFF.md`.

## Branch/PR discipline

Until a different workflow is approved:

- `main` is the canonical baseline.
- Consequential implementation should use a feature branch and PR where practical.
- Do not merge a red quality gate.
- Record the exact merged SHA in the handoff.
- After merge, verify the post-merge CI/deployment state rather than assuming PR checks imply production success.

## Security baseline

- Never commit Shopify client secrets, access tokens, database credentials, session secrets, or private merchant data.
- Use environment variables / deployment secret storage.
- Verify webhook HMAC.
- Use session-token authentication per Shopify requirements for embedded apps.
- Implement mandatory privacy compliance webhooks before App Store submission.
- Public-app offline access tokens must follow Shopify's current expiring-token requirements.

## When Shopify documentation conflicts with this repository

Shopify platform behavior is external and can change. If official current Shopify documentation contradicts a dated platform assumption here:

1. Treat the official current behavior as evidence.
2. Record the discrepancy.
3. Update the affected baseline document deliberately.
4. Run regression tests before changing production behavior.

Do not silently change product scope merely because a Shopify API capability changed.
