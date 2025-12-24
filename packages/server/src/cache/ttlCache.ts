import { LRUCache } from "lru-cache";
export class TtlCache<T extends object> {
  private cache: LRUCache<string, T>;
  constructor(ttlMs:number, max=5000) { this.cache = new LRUCache<string,T>({ max, ttl: ttlMs }); }
  get(key:string){ return this.cache.get(key); }
  set(key:string,val:T){ this.cache.set(key,val); }
  delete(key:string){ this.cache.delete(key); }
}
