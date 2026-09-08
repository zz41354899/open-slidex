export type SourceHistoryEntry = { source: string } | { start: number; remove: number; insert: string };
export const HISTORY_BYTE_BUDGET = 8 * 1024 * 1024;

/** Older entries are reverse patches against the next newer entry. The newest is a checkpoint. */
export function pushSourceHistory(history: SourceHistoryEntry[], source: string, budget = HISTORY_BYTE_BUDGET) {
  const last = history.at(-1);
  if (last && "source" in last && last.source === source) return history;
  const next = history.slice(-79);
  if (last && "source" in last) {
    const previous = last.source;
    let start = 0;
    while (start < previous.length && start < source.length && previous[start] === source[start]) start++;
    let suffix = 0;
    while (suffix < previous.length - start && suffix < source.length - start && previous[previous.length - suffix - 1] === source[source.length - suffix - 1]) suffix++;
    next[next.length - 1] = { start, remove: source.length - start - suffix, insert: previous.slice(start, previous.length - suffix) };
  }
  next.push({ source });
  const cost = (entry: SourceHistoryEntry) => ("source" in entry ? entry.source.length : entry.insert.length) * 2 + 32;
  let bytes = next.reduce((sum, entry) => sum + cost(entry), 0);
  while (next.length && bytes > budget) bytes -= cost(next.shift()!);
  return next;
}

export function popSourceHistory(history: SourceHistoryEntry[]) {
  const latest = history.pop();
  if (!latest || !("source" in latest)) return undefined;
  const previous = history.at(-1);
  if (previous && !("source" in previous)) {
    history[history.length - 1] = { source: latest.source.slice(0, previous.start) + previous.insert + latest.source.slice(previous.start + previous.remove) };
  }
  return latest.source;
}
