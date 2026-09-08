import { stat, type FileHandle } from "node:fs/promises";

export async function fileFingerprint(file: string | FileHandle) {
  const value = typeof file === "string"
    ? await stat(file, { bigint: true })
    : await file.stat({ bigint: true });
  return `${value.dev}:${value.ino}:${value.size}:${value.mtimeNs}:${value.ctimeNs}`;
}

export async function mapConcurrent<T, R>(values: T[], limit: number, task: (value: T) => Promise<R>) {
  const result = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) { const index = cursor++; result[index] = await task(values[index]); }
  }));
  return result;
}
