# Security Policy / Engineering Baseline

CatalogGuard is not yet a released product. This document defines the minimum security posture expected during implementation and pilot work.

## Supported versions

No public production version is currently released.

## Secret handling

Never commit:

- Shopify API secrets;
- Shopify access/refresh tokens;
- session secrets;
- database credentials;
- production webhook secrets/config values;
- private merchant catalog exports;
- support credentials;
- third-party service keys.

Use local `.env` files excluded from Git plus deployment-provider secret storage.

Commit an `.env.example` only after the Shopify scaffold establishes the actual variable names; placeholders must contain no real credentials.

## Access scope policy

Use least privilege.

V1 should begin with catalog read access and add only scopes required by implemented, approved rules.

New scopes require:

1. documented feature requirement;
2. exact Shopify fields/actions needing them;
3. review of lower-privilege alternatives;
4. documentation update;
5. reauthorization/test plan if required.

Avoid protected customer/order data in V1.

## Authentication

Use Shopify's current official authentication/session tooling for React Router embedded apps.

Do not hand-roll OAuth/session token handling without a verified platform reason.

Public-app offline Admin API access must use current expiring-token/refresh behavior.

## Webhooks

All Shopify webhooks must:

- validate Shopify HMAC/signature using the official/current approach;
- reject invalid signatures;
- tolerate duplicate delivery;
- use persistent idempotency/receipt tracking;
- acknowledge promptly;
- avoid trusting payload alone when authoritative current state is required;
- log failures without leaking secrets.

## Privacy compliance

Before App Store submission, implement and test Shopify's mandatory compliance webhooks, currently including:

- `customers/data_request`
- `customers/redact`
- `shop/redact`

Even if CatalogGuard has no customer data, the required endpoints/subscriptions must satisfy Shopify's current App Store requirements.

## Shop data deletion

Shop-scoped data must be designed for deterministic removal/anonymization when required.

Maintain a tested deletion procedure that covers:

- shop record/state;
- sessions/tokens as appropriate;
- policies/revisions;
- scans;
- snapshots;
- identifier indexes;
- findings/evaluations;
- exceptions;
- webhook receipts;
- preflight evidence;
- app audit events.

Do not leave orphaned merchant data after redaction because a foreign key/table was forgotten.

## Data minimization

Store only catalog-derived fields needed for:

- rule evaluation;
- finding explanation;
- regression detection;
- change evidence;
- preflight reproducibility;
- operational diagnostics.

Do not create an indefinite full-copy warehouse of every Shopify product field by default.

## Logging

Never log:

- access tokens;
- refresh tokens;
- API secrets;
- raw Authorization headers;
- full session payloads;
- unnecessary merchant catalog content.

Use identifiers and structured error codes where possible.

## Database

Production database requirements:

- TLS in transit where provided/required;
- provider-level encryption at rest where available;
- strong credentials;
- access limited to application/admin needs;
- backups/recovery appropriate to pilot/production stage;
- migrations through version-controlled tooling;
- no public unauthenticated database endpoint.

## Dependencies

- pin via lockfile;
- review dependency update alerts;
- avoid unnecessary packages;
- run vulnerability checks in CI or scheduled maintenance;
- prioritize fixes for exploitable production dependencies.

Do not perform opportunistic major dependency upgrades during unrelated bug fixes.

## App endpoints

- authenticate merchant routes;
- authorize shop ownership/context server-side;
- never trust shop IDs/domains from client parameters without validated session context;
- validate form/JSON input;
- use CSRF/session protections provided by the Shopify framework pattern;
- apply rate/abuse protection where endpoints could trigger expensive scans.

## Multi-tenancy

Every shop-scoped query/update must be constrained by authenticated shop identity.

Automated tests should include cross-shop isolation cases once more than one shop fixture exists.

A merchant must never retrieve another merchant's:

- policies;
- findings;
- catalog snapshots;
- preflights;
- exports;
- exceptions.

## CSV uploads — if implemented

Treat merchant CSVs as untrusted input.

Requirements:

- size limits;
- streaming parsing where appropriate;
- formula-injection-safe CSV export handling;
- no arbitrary filesystem paths;
- content/type validation;
- bounded processing;
- explicit retention/deletion policy;
- no automatic application to Shopify in initial CSV-preflight design.

## Admin UI extension

The extension must not embed secrets or privileged business logic in client code.

Server authorization remains authoritative.

## Incident handling

If a credential/data exposure is suspected:

1. stop further exposure;
2. rotate/revoke affected secrets/tokens;
3. preserve evidence/logs safely;
4. identify affected shops/data;
5. follow Shopify/provider/legal notification obligations as applicable;
6. fix the root cause;
7. add regression tests;
8. record the incident/fix without publishing merchant secrets.

## Reporting a vulnerability

A public security contact/process should be added before commercial launch. Until then, repository owner contact is the internal escalation path.
