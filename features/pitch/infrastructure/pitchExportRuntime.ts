export type MotionDocExportWindow = Window & {
  __motionDocExport?: {
    prepareStaticExport: () => Promise<{ slideCount: number }>;
  };
};

const EXPORT_API_MAX_ATTEMPTS = 120;
const EXPORT_RENDERER_LOAD_TIMEOUT_MS = 30_000;

export function waitForPitchExportIframe(iframe: HTMLIFrameElement) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Export renderer timed out")), EXPORT_RENDERER_LOAD_TIMEOUT_MS);
    iframe.addEventListener("load", () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

export async function preparePitchExportWindow(frameWindow: MotionDocExportWindow) {
  for (let attempt = 0; attempt < EXPORT_API_MAX_ATTEMPTS; attempt += 1) {
    if (frameWindow.__motionDocExport?.prepareStaticExport) {
      await frameWindow.__motionDocExport.prepareStaticExport();
      return;
    }
    await wait(100);
  }
  throw new Error("Export renderer unavailable");
}

export function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}
