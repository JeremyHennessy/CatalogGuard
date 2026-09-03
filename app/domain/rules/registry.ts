import type { RuleDefinition } from "./contracts";
import { barcodeRequiredRule, barcodeUniqueRule } from "./builtin/barcode";
import { descriptionRequiredRule } from "./builtin/description";
import { compareAtRelationshipRule, minimumPriceRule } from "./builtin/pricing";
import { skuRequiredRule, skuUniqueRule } from "./builtin/sku";

export class RuleRegistry {
  private readonly definitions = new Map<string, RuleDefinition<unknown>>();

  register<TConfig>(definition: RuleDefinition<TConfig>) {
    const key = this.key(definition.code, definition.version);

    if (this.definitions.has(key)) {
      throw new Error(`duplicate rule definition: ${key}`);
    }

    this.definitions.set(key, definition as RuleDefinition<unknown>);
    return this;
  }

  get(code: string, version: number): RuleDefinition<unknown> {
    const definition = this.definitions.get(this.key(code, version));

    if (!definition) {
      throw new Error(`unknown rule definition: ${code}@${version}`);
    }

    return definition;
  }

  list(): readonly RuleDefinition<unknown>[] {
    return [...this.definitions.values()].sort((a, b) =>
      `${a.code}@${a.version}`.localeCompare(`${b.code}@${b.version}`),
    );
  }

  private key(code: string, version: number) {
    return `${code}@${version}`;
  }
}

export function createBuiltinRuleRegistry(): RuleRegistry {
  return new RuleRegistry()
    .register(skuRequiredRule)
    .register(skuUniqueRule)
    .register(barcodeRequiredRule)
    .register(barcodeUniqueRule)
    .register(minimumPriceRule)
    .register(compareAtRelationshipRule)
    .register(descriptionRequiredRule);
}
