import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page
} from "playwright-core";

const idleTimeoutMilliseconds = 30_000;
let pooledBrowser: Browser | undefined;
let browserLaunch: Promise<Browser> | undefined;
let activePages = 0;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

export async function launchSlideXChromium() {
  const executablePath = process.env.OPEN_SLIDEX_CHROMIUM_EXECUTABLE?.trim();
  const launch = executablePath ? chromium.launch({
    headless: true,
    executablePath
  }) : chromium.launch({ channel: "chrome", headless: true }).catch(() => chromium.launch({ headless: true }));
  return launch.catch(() => {
    throw new Error(
      "OpenSlideX render needs Chromium. Install Chrome or Chromium and set OPEN_SLIDEX_CHROMIUM_EXECUTABLE to its executable path, or install Playwright Chromium explicitly."
    );
  });
}

export async function withSlideXChromiumPage<T>(
  options: BrowserContextOptions,
  action: (page: Page) => Promise<T>,
  signal?: AbortSignal
) {
  signal?.throwIfAborted();
  activePages += 1;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  const abort = () => {
    void context?.close({ reason: "OpenSlideX rendering was cancelled." }).catch(() => undefined);
  };
  try {
    const browser = await abortable(
      acquireBrowser(),
      signal,
      () => scheduleIdleClose()
    );
    context = await abortable(
      browser.newContext(options),
      signal,
      (lateContext) => void lateContext.close({ reason: "OpenSlideX rendering was cancelled." }).catch(() => undefined)
    );
    page = await abortable(
      context.newPage(),
      signal,
      (latePage) => void latePage.context().close({ reason: "OpenSlideX rendering was cancelled." }).catch(() => undefined)
    );
    signal?.addEventListener("abort", abort, { once: true });
    signal?.throwIfAborted();
    return await action(page);
  } catch (error) {
    signal?.throwIfAborted();
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
    await context?.close().catch(() => undefined);
    activePages -= 1;
    scheduleIdleClose();
  }
}

export async function prepareSlideXPageForStaticExport(page: Page, signal?: AbortSignal) {
  signal?.throwIfAborted();
  await page.evaluate(async () => {
    await document.fonts.ready;
    const exportWindow = window as Window & {
      __motionDocExport?: {
        prepareStaticExport: (options?: { rasterScale?: number }) => Promise<{ slideCount: number }>;
      };
    };
    if (!exportWindow.__motionDocExport) {
      throw new Error("OpenSlideX static export renderer is unavailable.");
    }
    await exportWindow.__motionDocExport.prepareStaticExport();
  });
  signal?.throwIfAborted();
}

export async function closeSlideXChromiumPool() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = undefined;
  const browser = pooledBrowser;
  pooledBrowser = undefined;
  browserLaunch = undefined;
  await browser?.close().catch(() => undefined);
}

async function acquireBrowser() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = undefined;
  if (pooledBrowser?.isConnected()) return pooledBrowser;
  browserLaunch ??= launchSlideXChromium().then((browser) => {
    pooledBrowser = browser;
    browser.on("disconnected", () => {
      if (pooledBrowser === browser) pooledBrowser = undefined;
    });
    return browser;
  }).finally(() => {
    browserLaunch = undefined;
  });
  return browserLaunch;
}

function scheduleIdleClose() {
  if (activePages > 0 || !pooledBrowser) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    void closeSlideXChromiumPool();
  }, idleTimeoutMilliseconds);
  idleTimer.unref?.();
}

function abortable<T>(
  operation: Promise<T>,
  signal?: AbortSignal,
  disposeLateValue?: (value: T) => void
) {
  if (!signal) return operation;
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const abort = () => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      reject(signal.reason ?? new Error("OpenSlideX rendering was cancelled."));
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    operation.then(
      (value) => {
        if (settled) {
          disposeLateValue?.(value);
          return;
        }
        settled = true;
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", abort);
        reject(error);
      }
    );
  });
}
