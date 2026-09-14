import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadPolicyFromYaml, validatePolicy, type Policy } from "@stellar-txguard/core";

export interface StoredPolicy extends Policy {
  id: string;
}

/**
 * In-memory policy store seeded from a directory of YAML files.
 * Policies created via the API live only for the process lifetime; persistent
 * storage is tracked in docs/drips-wave.md.
 */
export class PolicyStore {
  private readonly policies = new Map<string, StoredPolicy>();

  static async fromDirectory(dir: string): Promise<PolicyStore> {
    const store = new PolicyStore();
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return store; // missing directory → empty store
    }
    for (const file of entries.filter((f) => /\.ya?ml$/.test(f)).sort()) {
      const text = await readFile(path.join(dir, file), "utf8");
      const id = file.replace(/\.ya?ml$/, "");
      store.policies.set(id, { id, ...loadPolicyFromYaml(text) });
    }
    return store;
  }

  list(): StoredPolicy[] {
    return [...this.policies.values()];
  }

  get(id: string): StoredPolicy | undefined {
    return this.policies.get(id);
  }

  create(id: string, input: unknown): StoredPolicy {
    const policy = validatePolicy(input);
    const stored = { id, ...policy };
    this.policies.set(id, stored);
    return stored;
  }

  has(id: string): boolean {
    return this.policies.has(id);
  }
}
