import type {
  PolicyRevisionInputV1,
  ValidatedPolicyRevisionV1,
} from "../domain/policy/contracts";

export type PolicyRevisionSnapshotMetadata = Readonly<{
  nameSnapshot: string;
  descriptionSnapshot?: string;
  createdByActor?: string;
  changeSummary?: string;
}>;

export type CreatePolicyInput = Readonly<{
  shopId: string;
  name: string;
  description?: string;
  initialRevision: ValidatedPolicyRevisionV1;
  createdByActor?: string;
}>;

export type AppendPolicyRevisionInput = Readonly<{
  policyId: string;
  revision: ValidatedPolicyRevisionV1;
  snapshot: PolicyRevisionSnapshotMetadata;
}>;

export interface PolicyRepository {
  createPolicy(input: CreatePolicyInput): Promise<void>;
  appendRevision(input: AppendPolicyRevisionInput): Promise<void>;
  activateRevision(policyId: string, revisionId: string): Promise<void>;
  loadRevisionInput(revisionId: string): Promise<PolicyRevisionInputV1 | null>;
}
