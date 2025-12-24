import { LRUCache } from "lru-cache";
import { MaximoClient } from "./client.js";

type Shape = {
  objectStructure: string;
  fields: string[];
  discoveredAt: number;
};

export class MetadataCache {
  private cache: LRUCache<string, Shape>;
  constructor(private defaultTtlSeconds: number) {
    this.cache = new LRUCache({ max: 256 });
  }

  private key(tenantId: string, os: string) { return `${tenantId}::${os}`; }

  async getShape(tenantId: string, objectStructure: string, client: MaximoClient, ttlSeconds?: number): Promise<Shape> {
    const ttl = (ttlSeconds ?? this.defaultTtlSeconds) * 1000;
    const k = this.key(tenantId, objectStructure);
    const existing = this.cache.get(k);
    if (existing && (Date.now() - existing.discoveredAt) < ttl) return existing;

    // infer fields from first record (best-effort)
    // For schema discovery we don't need a filter; Maximo's OSLC parser rejects SQL-ish "1=1".
    // Only include oslc.where when explicitly configured for the query.
    const out = await client.oslcQuery(objectStructure, { select: "*", pageSize: 1, start: 0 });
    const item = out.items?.[0] ?? {};
    const fields = Object.keys(item).filter(f => typeof f === "string").sort();
    const shape: Shape = { objectStructure, fields, discoveredAt: Date.now() };
    this.cache.set(k, shape);
    return shape;
  }
}
