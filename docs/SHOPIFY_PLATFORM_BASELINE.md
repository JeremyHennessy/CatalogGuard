# Shopify Platform Baseline

**Baseline date:** 2026-09-03

This document records time-sensitive Shopify platform assumptions used by CatalogGuard. Re-verify them before implementation if material time has passed or Shopify publishes breaking changes.

## 1. App framework

Shopify currently recommends the **React Router app template** for most new apps.

Reference:

- https://shopify.dev/docs/apps/build/scaffold-app
- https://shopify.dev/docs/api/shopify-app-react-router/latest

Baseline decision:

- use Shopify CLI;
- scaffold a React Router app;
- use official Shopify app package and App Bridge;
- do not invent custom OAuth/session plumbing unless the official stack is proven inadequate.

## 2. Admin API

The REST Admin API is legacy. Shopify documentation states that new public apps must use the **GraphQL Admin API** for Admin API functionality.

Reference:

- https://shopify.dev/docs/api/admin-rest
- https://shopify.dev/docs/api/admin-graphql/latest

Baseline decision:

- new CatalogGuard Admin API code uses GraphQL only.

## 3. API version

As of 2026-09-03, `2026-07` is a stable supported Shopify API version.

Reference:

- https://shopify.dev/docs/api/usage/versioning

Baseline decision:

```text
SHOPIFY API PIN = 2026-07
```

Do not silently move to `latest`, `unstable`, or a future release candidate.

The version must be reviewed before its support window ends and whenever Shopify publishes a relevant breaking change.

## 4. Bulk GraphQL operations

Shopify GraphQL bulk operations support asynchronous retrieval of large connection datasets and nested connections.

In API versions `2026-01` and higher, Shopify documents support for up to **five concurrent bulk query operations per app per shop**.

Reference:

- https://shopify.dev/docs/api/usage/bulk-operations/queries

Baseline use:

- prefer bulk operations for complete catalog retrieval where appropriate;
- do not manually paginate a large catalog solely out of habit;
- track bulk operation identity/status persistently;
- process result files without assuming they fit comfortably in memory.

## 5. Embedded authentication

Shopify App Store requirements include session-token authentication behavior for embedded apps.

Reference:

- https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements

Baseline:

- follow current official template/session-token architecture;
- test embedded app in the conditions Shopify requires, including cookie/storage constraints documented at submission time.

## 6. Offline access tokens

Shopify has announced that public apps must use **expiring offline access tokens** for Admin API requests by **2027-01-01**. Shopify's current scaffold/tooling supports the modern token/refresh approach.

References:

- https://shopify.dev/changelog/expiring-offline-access-tokens-required-for-all-public-apps-as-of-january-1-2027
- https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
- https://shopify.dev/docs/apps/build/authentication-authorization/migrate-to-expiring-offline-access-tokens

Baseline:

- build CatalogGuard from the outset using current expiring-token behavior rather than creating migration debt.

## 7. Webhooks

Shopify webhooks provide near-real-time change signals and should be combined with reconciliation rather than treated as a complete database replication guarantee.

References:

- https://shopify.dev/docs/apps/build/webhooks
- https://shopify.dev/docs/apps/build/webhooks/subscribe
- https://shopify.dev/docs/api/webhooks/latest

Baseline:

- configure app-specific subscriptions through supported app configuration where appropriate;
- verify HMAC;
- make processing idempotent;
- acknowledge promptly;
- persist processing state;
- fetch authoritative current resource data when webhook payload is insufficient;
- run complete reconciliation periodically/on demand.

Exact product/catalog webhook topics must be confirmed against API `2026-07` when implementation begins.

## 8. Mandatory privacy compliance webhooks

Shopify requires App Store-distributed apps to subscribe to mandatory privacy compliance topics even when the app does not collect customer data.

Currently documented topics:

```text
customers/data_request
customers/redact
shop/redact
```

Reference:

- https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance

Baseline:

- implement/verify these endpoints before App Store submission;
- invalid HMAC must not be accepted;
- `shop/redact` must drive the documented store-data deletion process.

## 9. Protected customer data

Shopify has additional requirements for apps using protected customer data.

Reference:

- https://shopify.dev/docs/apps/launch/protected-customer-data

CatalogGuard V1 baseline:

- do not request customer or order data;
- do not request protected customer data access;
- keep the product catalog-focused unless a future approved feature clearly requires otherwise.

## 10. Access scopes

Initial expected scope direction:

```text
read_products
```

Additional catalog/inventory scopes may be required by specific rule families and must be verified before implementation.

Baseline principle:

- least privilege;
- no speculative scopes;
- no `write_products` for read-only V1 merely to make fixes easier;
- document every added scope and the exact feature that needs it.

## 11. Admin UI extensions

Shopify Admin UI extensions can place app UI/actions within Shopify Admin resource workflows.

Reference:

- https://shopify.dev/docs/api/admin-extensions/latest

As of the baseline, Shopify's docs also describe unit-test support for Admin UI extensions in supported versions using `@shopify/ui-extensions-tester`.

Baseline use:

- add a product detail status block/action only after server-side policy/finding semantics are stable;
- keep business logic out of the extension;
- use current supported target/version when generated.

Do not assume every Shopify Admin screen/action can be intercepted or blocked by an extension.

## 12. Shopify Flow

Third-party apps can expose triggers for Shopify Flow.

Reference:

- https://shopify.dev/docs/apps/build/flow/triggers

Baseline use:

- CatalogGuard may expose catalog-domain triggers such as a blocking regression;
- use Shopify Flow for downstream merchant automation instead of building a broad workflow engine.

## 13. Billing

Shopify App Store apps must use Shopify-provided billing.

Shopify App Pricing is documented as the default/recommended pricing mechanism for new public apps with supported pricing models.

References:

- https://shopify.dev/docs/apps/launch/billing
- https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements

Baseline:

- do not implement Stripe/off-platform subscription billing for an App Store-distributed paid CatalogGuard app;
- defer detailed plan integration until the core pilot value is established;
- use Shopify-hosted pricing/billing capabilities where appropriate.

## 14. App Store review baseline

Before submission, re-read the complete current requirements.

Reference:

- https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements

Expected areas include:

- authentication/session behavior;
- Shopify billing;
- privacy compliance;
- truthful app behavior/claims;
- functional install/reinstall;
- support/privacy resources;
- safe use of Shopify platform capabilities.

Do not prepare submission from this dated checklist alone.

## 15. App configuration deployment

Shopify app configuration changes in `shopify.app.toml` require the appropriate Shopify app deploy workflow to become production app configuration.

Reference:

- https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration

Baseline release procedure must therefore distinguish:

- GitHub code deployed to app host;
- Shopify app configuration/extension version deployed through Shopify tooling.

Both may need evidence for a release.

## 16. Platform watch items

Future chats should specifically check Shopify changelog for:

- API `2026-07` deprecations/removals;
- product/variant schema changes;
- inventory/weight/cost field changes;
- webhook topic/payload changes;
- Admin UI extension target/version changes;
- session/offline-token behavior;
- App Pricing changes;
- App Store review/privacy requirements;
- Flow extension changes.

Changelog:

- https://shopify.dev/changelog

## 17. Known upcoming item at baseline

Public apps must be prepared for the 2027-01-01 expiring offline-token requirement. Because CatalogGuard is being created after this change was announced, there is no reason to intentionally start with legacy non-expiring public-app token behavior.

## 18. Platform facts must not become product promises

Examples:

- Admin UI extensions existing does not prove CatalogGuard can block all native publication operations.
- webhooks existing does not prove guaranteed zero-lag monitoring.
- bulk operations existing does not prove arbitrary catalog sizes will complete within a marketed SLA.
- write APIs existing does not approve automatic remediation.

Product claims require CatalogGuard-specific implementation evidence.
