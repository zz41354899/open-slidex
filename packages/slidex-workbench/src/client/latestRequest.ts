/** Debounce bursts and serialize requests. Changes during a request produce one trailing request. */
export function latestRequest<T>(send: (value: T) => Promise<unknown>, delay = 100) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { value: T } | undefined;
  let running = false;
  let disposed = false;
  async function flush() {
    timer = undefined;
    if (running || disposed || !pending) return;
    const { value } = pending;
    pending = undefined;
    running = true;
    try { await send(value); } finally {
      running = false;
      if (pending && !disposed) timer = setTimeout(() => void flush(), delay);
    }
  }
  return {
    schedule(value: T) {
      if (disposed) return;
      pending = { value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delay);
    },
    dispose() { disposed = true; pending = undefined; if (timer) clearTimeout(timer); }
  };
}
