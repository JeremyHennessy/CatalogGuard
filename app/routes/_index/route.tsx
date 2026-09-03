import type { LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function Index() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <main className={styles.index}>
      <section className={styles.content}>
        <p className={styles.eyebrow}>Catalog governance for Shopify</p>
        <h1 className={styles.heading}>CatalogGuard</h1>
        <p className={styles.text}>
          Define catalog policy, separate legacy debt from new regressions, and
          run evidence-backed preflight checks before launches and imports.
        </p>

        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input
                className={styles.input}
                type="text"
                name="shop"
                placeholder="example.myshopify.com"
              />
            </label>
            <button className={styles.button} type="submit">
              Connect development store
            </button>
          </Form>
        )}

        <ul className={styles.list}>
          <li>Read-only Phase 1 catalog access.</li>
          <li>GraphQL Admin API pinned to 2026-07.</li>
          <li>No customer, order, or product-write scopes.</li>
        </ul>
      </section>
    </main>
  );
}
