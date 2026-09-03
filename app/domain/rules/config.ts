export class RuleConfigError extends Error {
  readonly ruleCode: string;

  constructor(ruleCode: string, message: string) {
    super(`${ruleCode}: ${message}`);
    this.name = "RuleConfigError";
    this.ruleCode = ruleCode;
  }
}

export type ConfigSchema<T> = {
  parse(input: unknown): T;
};

export function schema<T>(parse: (input: unknown) => T): ConfigSchema<T> {
  return { parse };
}

export function asObject(
  input: unknown,
  ruleCode: string,
): Record<string, unknown> {
  if (input === undefined) return {};

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new RuleConfigError(ruleCode, "configuration must be an object");
  }

  return input as Record<string, unknown>;
}

export function rejectUnknownKeys(
  object: Record<string, unknown>,
  allowed: readonly string[],
  ruleCode: string,
) {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(object).filter((key) => !allowedSet.has(key));

  if (unknown.length > 0) {
    throw new RuleConfigError(
      ruleCode,
      `unknown configuration key(s): ${unknown.join(", ")}`,
    );
  }
}

export function parseStringEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  ruleCode: string,
  fieldName: string,
  defaultValue?: T,
): T {
  if (value === undefined && defaultValue !== undefined) return defaultValue;

  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new RuleConfigError(
      ruleCode,
      `${fieldName} must be one of: ${allowed.join(", ")}`,
    );
  }

  return value as T;
}

export function parsePositiveInteger(
  value: unknown,
  ruleCode: string,
  fieldName: string,
  defaultValue?: number,
): number {
  if (value === undefined && defaultValue !== undefined) return defaultValue;

  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new RuleConfigError(
      ruleCode,
      `${fieldName} must be a positive integer`,
    );
  }

  return value as number;
}

export function parseNonNegativeDecimal(
  value: unknown,
  ruleCode: string,
  fieldName: string,
): string {
  if (typeof value !== "string" || !isNonNegativeDecimal(value)) {
    throw new RuleConfigError(
      ruleCode,
      `${fieldName} must be a non-negative decimal string`,
    );
  }

  return value;
}

export function isNonNegativeDecimal(value: string): boolean {
  return /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
}
