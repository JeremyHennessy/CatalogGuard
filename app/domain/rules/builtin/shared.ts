import type { FieldEvidence } from "../../catalog/model";
import type {
  RuleDefinition,
  RuleResult,
} from "../contracts";
import { resultForTarget } from "../contracts";
import { schema, asObject, rejectUnknownKeys } from "../config";

export const emptyConfigSchema = (ruleCode: string) =>
  schema<Record<string, never>>((input) => {
    const object = asObject(input, ruleCode);
    rejectUnknownKeys(object, [], ruleCode);
    return {};
  });

export function unavailableFieldResult(
  definition: RuleDefinition<unknown>,
  target: Parameters<typeof resultForTarget>[1],
  fieldName: string,
  field: Exclude<FieldEvidence<unknown>, { availability: "AVAILABLE" }>,
): RuleResult {
  return resultForTarget(
    definition,
    target,
    "UNKNOWN",
    `${fieldName} evidence is unavailable.`,
    {
      reasonCode: `FIELD_${field.availability}`,
      evidence: {
        field: fieldName,
        availability: field.availability,
        reason: field.reason,
      },
    },
  );
}
