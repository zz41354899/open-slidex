import { randomUUID } from "node:crypto";
import { open, readFile, stat, unlink } from "node:fs/promises";

type SlideXFileLockMetadata = {
  createdAt: string;
  ownerId: string;
  pid: number;
};

export async function withSlideXFileLock<T>(
  lockPath: string,
  action: () => Promise<T>,
  options: { timeoutMilliseconds?: number; staleMilliseconds?: number } = {}
) {
  const owner: SlideXFileLockMetadata = {
    createdAt: new Date().toISOString(),
    ownerId: randomUUID(),
    pid: process.pid
  };
  const deadline = Date.now() + (options.timeoutMilliseconds ?? 5_000);
  const staleMilliseconds = options.staleMilliseconds ?? 30_000;

  while (true) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(owner)}\n`, "utf8");
      } finally {
        await handle.close();
      }
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (await recoverStaleLock(lockPath, staleMilliseconds)) continue;
      if (Date.now() >= deadline) throw new Error("presentation.mdx is busy. Open it again before retrying.");
      await wait(20);
    }
  }

  try {
    return await action();
  } finally {
    const current = await readLock(lockPath);
    if (current?.ownerId === owner.ownerId) {
      await unlink(lockPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
}

async function recoverStaleLock(lockPath: string, staleMilliseconds: number) {
  const raw = await readFile(lockPath, "utf8").catch(() => undefined);
  const metadata = parseLock(raw);
  const recoverable = metadata
    ? !processIsAlive(metadata.pid)
    : await stat(lockPath).then((value) => Date.now() - value.mtimeMs >= staleMilliseconds, () => false);
  if (!recoverable) return false;
  const latest = await readFile(lockPath, "utf8").catch(() => undefined);
  if (latest !== raw) return false;
  return unlink(lockPath).then(() => true, (error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return true;
    throw error;
  });
}

async function readLock(lockPath: string) {
  return parseLock(await readFile(lockPath, "utf8").catch(() => undefined));
}

function parseLock(value: string | undefined): SlideXFileLockMetadata | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Partial<SlideXFileLockMetadata>;
    return typeof parsed.ownerId === "string" && typeof parsed.pid === "number" && typeof parsed.createdAt === "string"
      ? parsed as SlideXFileLockMetadata
      : undefined;
  } catch {
    return undefined;
  }
}

function processIsAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
