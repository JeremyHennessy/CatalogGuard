import { isNonNegativeDecimal } from "./config";

function splitDecimal(value: string) {
  const [integer, fraction = ""] = value.split(".");
  return {
    integer: integer.replace(/^0+(?=\d)/, ""),
    fraction,
  };
}

export function compareDecimalStrings(left: string, right: string): number {
  if (!isNonNegativeDecimal(left) || !isNonNegativeDecimal(right)) {
    throw new Error("compareDecimalStrings requires non-negative decimals");
  }

  const a = splitDecimal(left);
  const b = splitDecimal(right);

  if (a.integer.length !== b.integer.length) {
    return a.integer.length > b.integer.length ? 1 : -1;
  }

  if (a.integer !== b.integer) {
    return a.integer > b.integer ? 1 : -1;
  }

  const width = Math.max(a.fraction.length, b.fraction.length);
  const aFraction = a.fraction.padEnd(width, "0");
  const bFraction = b.fraction.padEnd(width, "0");

  if (aFraction === bFraction) return 0;
  return aFraction > bFraction ? 1 : -1;
}
