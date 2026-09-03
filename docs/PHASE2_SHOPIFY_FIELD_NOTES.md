# Phase 2 Shopify Field Notes

This note records Shopify field/scope assumptions for the first fixture-driven rule-engine slice. It is not evidence that CatalogGuard has successfully queried a real store.

## Platform reference

Checked 2026-09-03 against Shopify Admin GraphQL documentation for API `2026-07` / latest.

The Shopify `Product` object requires `read_products` and exposes the fields needed for the initial normalized model, including product status, description, vendor, product type, tags, category, SEO metadata, variants, and media-related data.

The Shopify `products` query can return product metadata, options/variants, pricing, media, SEO metadata, category, tags, and publishing/status information under the product catalog access path.

`ProductVariant` exposes `sku`, `barcode`, `price`, and `compareAtPrice`. These fields are candidates for the first deterministic variant rules.

## First-slice normalized fields

The Phase 2 fixture model currently represents:

Product:
- `gid`
- `title`
- `status`
- normalized plain-text `descriptionText`
- SEO title/description
- vendor
- product type
- tags
- category GID
- media count
- variants

Variant:
- `gid`
- parent product GID
- title
- SKU
- barcode
- price
- compare-at price
- selected options

Every evidence-bearing field is wrapped in explicit availability state:
- `AVAILABLE`
- `UNAVAILABLE`
- `NOT_REQUESTED`
- `UNRELIABLE`

Rules must return `UNKNOWN` when required evidence is not reliably available.

## Live-verification boundary

The current Phase 1 route already contains a source-level query for product/variant `id`, `title`, `handle`, `status`, `updatedAt`, variant `id`, variant `title`, `sku`, `barcode`, and `price`.

However, no Shopify development-store installation or authenticated response is yet verified. Therefore:

- do not mark any Phase 2 source mapping as production-verified;
- do not add weight, inventory, or cost rules yet;
- do not add scopes beyond `read_products` until exact Shopify fields and live access behavior require them;
- compare-at price, description, SEO, category, media count, and option mapping should be wired into the Shopify adapter only after the live Phase 1 app query is available for inspection.

## References checked

- Shopify Admin GraphQL `Product` object, API version selector showing `2026-07`
- Shopify Admin GraphQL `ProductVariant` object
- Shopify Admin GraphQL `products` query
- Shopify local app development documentation for `shopify app dev`
