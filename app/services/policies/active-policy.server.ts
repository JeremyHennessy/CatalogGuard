import prisma from "../../db.server";
import { validatePolicyRevisionV1 } from "../../domain/policy/contracts";
import { createBuiltinRuleRegistry } from "../../domain/rules/registry";
import { PrismaPolicyRepository } from "../../persistence/prisma-policy-repository.server";

export async function loadActiveValidatedPolicyRevisionV1(
  shopId: string,
  policyId: string,
) {
  const policy = await prisma.policy.findFirst({
    where: { id: policyId, shopId },
    select: { activeRevisionId: true },
  });
  if (!policy?.activeRevisionId) return null;

  const repository = new PrismaPolicyRepository();
  const input = await repository.loadRevisionInput(policy.activeRevisionId);
  if (!input) {
    throw new Error(
      `active policy revision could not be loaded: ${policy.activeRevisionId}`,
    );
  }

  return validatePolicyRevisionV1(createBuiltinRuleRegistry(), input);
}
