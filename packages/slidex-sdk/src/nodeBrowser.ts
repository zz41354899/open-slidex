import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright-core";

const idleTimeoutMilliseconds = 30_000;
let pooledBrowser: Browser | undefined;
let browserLaunch: Promise<Browser> | undefined;
let activePages = 0;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

export async function launchSlideXChromium() {
  const executablePath = process.env.OPEN_SLIDEX_CHROMIUM_EXECUTABLE?.trim();
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {})
  }).catch(() => {
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
  const browser = await acquireBrowser();
  signal?.throwIfAborted();
  activePages += 1;
  let page: Page | undefined;
  const abort = () => {
    void page?.close().catch(() => undefined);
  };
  try {
    page = await browser.newPage(options);
    signal?.addEventListener("abort", abort, { once: true });
    signal?.throwIfAborted();
    return await action(page);
  } catch (error) {
    signal?.throwIfAborted();
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
    await page?.close().catch(() => undefined);
    activePages -= 1;
    scheduleIdleClose();
  }
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
