/** LRU with both entry and approximate byte limits; never retains oversized values. */
export class BoundedCache<K, V> {
  private readonly entries = new Map<K, { value: V; bytes: number }>();
  private bytes = 0;
  constructor(private readonly maxEntries: number, private readonly maxBytes: number) {}
  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key: K, value: V, bytes: number) {
    this.delete(key);
    if (bytes > this.maxBytes) return;
    this.entries.set(key, { value, bytes });
    this.bytes += bytes;
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      this.delete(this.entries.keys().next().value!);
    }
  }
  delete(key: K) {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.entries.delete(key);
  }
}
