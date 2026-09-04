# Decision Log

Record material product/architecture/commercial decisions here. Do not rewrite history; append a superseding decision when something changes.

## D-001 — Product category

**Date:** 2026-09-03

**Decision:** CatalogGuard will be built as a Shopify catalog governance product focused on merchant-defined policy, regression classification, exceptions, and preflight—not as a generic catalog health-score scanner.

**Reason:** Current 2026 Shopify App Store competition already includes multiple generic catalog audit/missing-field/SKU-check products, including recent entrants with overlapping features.

**Status:** Active.

## D-002 — V1 is predominantly read-only

**Date:** 2026-09-03

**Decision:** V1 should avoid broad catalog write permissions and destructive automatic remediation.

**Reason:** Lower merchant risk, easier trust/App Store review, lower support burden, and clearer differentiation from bulk-edit/revert products. Read-only status is not absolute if a narrowly scoped future feature is explicitly approved.

**Status:** Active.

## D-003 — API technology

**Date:** 2026-09-03

**Decision:** Use Shopify GraphQL Admin API for new public-app Admin API functionality; do not build new functionality on legacy REST Admin API.

**Reason:** Shopify platform requirement/direction for new public apps.

**Status:** Active.

## D-004 — API version baseline

**Date:** 2026-09-03

**Decision:** Pin initial implementation to Shopify API `2026-07`.

**Reason:** It is a stable supported version at baseline date. Pinning provides reproducibility and prevents silent behavior drift.

**Status:** Active until deliberately superseded after API upgrade testing.

## D-005 — Application framework

**Date:** 2026-09-03

**Decision:** Start with Shopify's recommended React Router app template and official Shopify tooling.

**Reason:** Reduces unnecessary authentication, embedding, billing, and platform integration risk.

**Status:** Active; may be changed only if implementation evidence shows a concrete blocker.

## D-006 — Rule evaluation states

**Date:** 2026-09-03

**Decision:** Rules return `PASS`, `FAIL`, `NOT_APPLICABLE`, or `UNKNOWN`.

**Reason:** Missing/unavailable evidence must not be misrepresented as compliance.

**Status:** Active / core semantic contract.

## D-007 — Severity and blocking are separate

**Date:** 2026-09-03

**Decision:** Rule severity and whether a rule blocks a policy/preflight are independent configuration.

**Reason:** Merchant workflows can require a lower-severity issue to block a launch while treating a high-severity finding as informational under another policy.

**Status:** Active.

## D-008 — Exceptions do not erase failure

**Date:** 2026-09-03

**Decision:** An active exception changes enforcement disposition to `WAIVED` but does not mutate a failed rule evaluation to PASS.

**Reason:** Preserve technical truth and historical/audit explainability.

**Status:** Active / core semantic contract.

## D-009 — Policies are revisioned immutably for evidence

**Date:** 2026-09-03

**Decision:** Editing a policy creates a new immutable PolicyRevision; historical scans/preflights reference exact revisions.

**Reason:** A historical “pass” is meaningless if the rules used can later change in place.

**Status:** Active.

## D-010 — Baseline debt is distinct from regression

**Date:** 2026-09-03

**Decision:** First-scan failures established as baseline debt must be distinguishable from failures introduced after baseline.

**Reason:** This is a central product differentiator and reduces alert fatigue for imperfect existing catalogs.

**Status:** Active.

## D-011 — Preflight supports indeterminate outcome

**Date:** 2026-09-03

**Decision:** Preflight outcomes include `PASS`, `PASS_WITH_WAIVERS`, `FAIL`, and `INDETERMINATE`.

**Reason:** Missing evidence for a blocking rule must not create a false pass.

**Status:** Active.

## D-012 — Webhooks plus reconciliation

**Date:** 2026-09-03

**Decision:** Use Shopify webhooks for incremental detection but retain complete reconciliation as a correctness mechanism.

**Reason:** Webhook-driven systems can experience missed/duplicate/out-of-order deliveries or local processing failures; source reconciliation is necessary for trust.

**Status:** Active.

## D-013 — Avoid protected customer data in V1

**Date:** 2026-09-03

**Decision:** V1 will not request orders/customers/protected buyer data.

**Reason:** Product does not require it, and avoiding it reduces privacy/compliance and security scope.

**Status:** Active.

## D-014 — Production persistence direction

**Date:** 2026-09-03

**Decision:** Prisma is preferred; local scaffold SQLite is acceptable for development, but production should move to durable PostgreSQL before multi-instance/pilot deployment.

**Reason:** Session/domain data, scan history, idempotency, and background processing need durable shared persistence.

**Status:** Active.

## D-015 — Hosting not yet selected

**Date:** 2026-09-03

**Decision:** Do not lock Vercel/Render/Railway/Fly/other host at documentation baseline.

**Reason:** Full-scan bulk result processing and background/retry requirements should be measured first. Hosting must fit the workload rather than drive architecture by convenience.

**Status:** Open decision to resolve during implementation.

## D-016 — CSV preflight is candidate scope

**Date:** 2026-09-03

**Decision:** Document CSV import preflight as a promising post-core feature, but do not make it a required initial MVP phase.

**Reason:** It increases parser/Shopify-format maintenance complexity and competing apps already use “before import” messaging. Merchant demand must justify it.

**Status:** Deferred / hypothesis.

## D-017 — Shopify Flow over custom automation engine

**Date:** 2026-09-03

**Decision:** Expose focused CatalogGuard events to Shopify Flow rather than building a general automation builder.

**Reason:** Shopify already supplies merchant automation infrastructure; CatalogGuard should own catalog-policy intelligence.

**Status:** Active.

## D-018 — Commercial pricing is a hypothesis

**Date:** 2026-09-03

**Decision:** Initial $19/$49/$99–149 plan concepts are research hypotheses, not approved final pricing.

**Reason:** Willingness to pay has not been tested with actual CatalogGuard users.

**Status:** Unvalidated.

## D-019 — Pilot usage defines product validation

**Date:** 2026-09-03

**Decision:** A first audit/installation alone does not validate the product. Stronger activation is baseline establishment plus a later regression review or preflight.

**Reason:** The commercial thesis depends on recurring governance value.

**Status:** Active commercial measurement principle.

## D-020 — No unsupported native publish-blocking claim

**Date:** 2026-09-03

**Decision:** Do not market CatalogGuard as universally preventing native Shopify product publication/saves unless a current Shopify-supported interception/enforcement mechanism is specifically verified and implemented.

**Reason:** Admin UI extensions and preflight tools do not automatically imply control over every native Shopify save/publish path.

**Status:** Active.

## D-021 — Preflight evidence uses immutable run records and materialized targets

**Date:** 2026-09-04

**Decision:** Persisted preflight evidence records the exact shop, linked PREFLIGHT scan, immutable policy revision, target definition, deterministic input fingerprint, outcome counts, source freshness, actor metadata, and materialized evaluated product/variant target fingerprints.

**Reason:** Product sets and collection membership can change after launch review. Historical preflight evidence must remain reproducible without being reinterpreted through the current catalog or a later policy revision.

**Status:** Active. Merchant product and collection preflight execution is wired to evidence-only run actions; PREFLIGHT scans do not update current Finding lifecycle until that product semantic is explicitly accepted.


## D-022 — Product preflight is evidence-only in V1

**Date:** 2026-09-04

**Decision:** Merchant-triggered product preflight creates immutable `PREFLIGHT` scan, evaluation, preflight-run, and materialized-target evidence, but does not create or update current `Finding` or `FindingEvent` lifecycle state.

**Reason:** Launch review should answer whether the selected target passes the current policy now without changing the global regression/current-state dashboard. Full reconciliation remains the explicit merchant action that updates current findings.

**Status:** Active for product preflight. Collection preflight follows the same evidence-only boundary under D-023. CSV preflight and future publish-blocking semantics remain separate decisions.

## D-023 — Collection preflight materializes live membership evidence

**Date:** 2026-09-04

**Decision:** Merchant-triggered collection preflight reads live collection product membership through Shopify Admin GraphQL, evaluates those materialized products against the exact active policy revision using complete catalog context, and persists a `COLLECTION` preflight run with exact product/variant target fingerprints. The path remains evidence-only and does not mutate current findings.

**Reason:** Collection membership can change after a launch review. Historical preflight evidence must preserve exactly which products and variants were evaluated without being reinterpreted through current collection membership, and the implementation should keep V1 read-only with no scopes beyond `read_products`.

**Status:** Active. Live Shopify acceptance and large-catalog Bulk Operations optimization remain pending.

## D-024 — Preflight export is persisted evidence only

**Date:** 2026-09-04

**Decision:** Preflight detail and JSON export must be derived from the persisted preflight run, linked scan, materialized targets, evaluation rows, immutable policy revision, policy-rule metadata, and referenced exception evidence. Export must not perform a live Shopify read or policy re-evaluation.

**Reason:** A historical preflight is evidence of what was evaluated at that time. Re-reading Shopify or re-running the current rule engine could silently reinterpret old launch evidence through changed catalog membership, changed product data, or changed policy semantics.

**Status:** Active. Live Shopify acceptance remains pending.
