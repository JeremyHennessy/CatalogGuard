import prisma from "../../db.server";
import {
  DEV_VALIDATION_POLICY_DESCRIPTION,
  DEV_VALIDATION_POLICY_NAME,
  assertDevValidationPolicyRevisionV1,
  devValidationPolicyIdentityV1,
  devValidationPolicyRevisionInputV1,
} from "../../domain/policy/dev-validation-template";
import { validatePolicyRevisionV1 } from "../../domain/policy/contracts";
import { createBuiltinRuleRegistry } from "../../domain/rules/registry";
import { PrismaPolicyRepository } from "../../persistence/prisma-policy-repository.server";

export async function ensureDevValidationPolicyV1(input: {
  shopId: string;
  createdAt: string;
  createdByActor?: string;
}) {
  const identity = devValidationPolicyIdentityV1(input.shopId);
  const repository = new PrismaPolicyRepository();
  const registry = createBuiltinRuleRegistry();
  const existing = await prisma.policy.findUnique({
    where: { id: identity.policyId },
    select: {
      id: true,
      shopId: true,
      name: true,
      activeRevisionId: true,
    },
  });

  if (!existing) {
    const revision = validatePolicyRevisionV1(
      registry,
      devValidationPolicyRevisionInputV1({
        shopId: input.shopId,
        createdAt: input.createdAt,
      }),
    );
    assertDevValidationPolicyRevisionV1(revision);

    await repository.createPolicy({
      shopId: input.shopId,
      name: DEV_VALIDATION_POLICY_NAME,
      description: DEV_VALIDATION_POLICY_DESCRIPTION,
      initialRevision: revision,
      createdByActor: input.createdByActor,
    });

    return revision;
  }

  if (existing.shopId !== input.shopId) {
    throw new Error(
      `dev validation policy ${identity.policyId} belongs to a different shop`,
    );
  }
  if (existing.name !== DEV_VALIDATION_POLICY_NAME) {
    throw new Error(
      `dev validation policy ${identity.policyId} has unexpected persisted identity`,
    );
  }
  if (existing.activeRevisionId !== identity.revisionId) {
    throw new Error(
      "dev validation policy active revision changed; explicit review is required before using it for baseline evidence",
    );
  }

  const revisionInput = await repository.loadRevisionInput(identity.revisionId);
  if (!revisionInput) {
    throw new Error(
      `dev validation policy revision not found: ${identity.revisionId}`,
    );
  }

  const revision = validatePolicyRevisionV1(registry, revisionInput);
  assertDevValidationPolicyRevisionV1(revision);
  return revision;
}
