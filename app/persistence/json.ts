const OMIT = Symbol("omit");

type CanonicalJson =
  | null
  | boolean
  | number
  | string
  | CanonicalJson[]
  | { [key: string]: CanonicalJson };

function canonicalize(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
  inArray: boolean,
): CanonicalJson | typeof OMIT {
  if (value === null) return null;

  if (value === undefined) {
    if (inArray || path === "$") {
      throw new TypeError(`${path} contains undefined, which is not valid JSON`);
    }

    return OMIT;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} contains a non-finite number`);
    }

    return value;
  }

  if (
    typeof value === "bigint" ||
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    throw new TypeError(`${path} contains a non-JSON value`);
  }

  if (typeof value !== "object") {
    throw new TypeError(`${path} contains an unsupported JSON value`);
  }

  if (seen.has(value)) {
    throw new TypeError(`${path} contains a circular reference`);
  }

  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        const normalized = canonicalize(
          item,
          `${path}[${index}]`,
          seen,
          true,
        );

        if (normalized === OMIT) {
          throw new TypeError(`${path}[${index}] contains undefined`);
        }

        return normalized;
      });
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${path} must contain only plain JSON objects`);
    }

    const result: Record<string, CanonicalJson> = {};

    for (const key of Object.keys(value).sort()) {
      const normalized = canonicalize(
        (value as Record<string, unknown>)[key],
        `${path}.${key}`,
        seen,
        false,
      );

      if (normalized !== OMIT) {
        result[key] = normalized;
      }
    }

    return result;
  } finally {
    seen.delete(value);
  }
}

export function canonicalJsonStringify(value: unknown): string {
  const normalized = canonicalize(value, "$", new WeakSet(), false);

  if (normalized === OMIT) {
    throw new TypeError("top-level undefined is not valid JSON");
  }

  return JSON.stringify(normalized);
}

export function parseCanonicalJson(value: string): unknown {
  const parsed: unknown = JSON.parse(value);
  const canonical = canonicalJsonStringify(parsed);

  if (canonical !== value) {
    throw new Error("persisted JSON is not in canonical form");
  }

  return parsed;
}
