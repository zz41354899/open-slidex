import { sanitizeMotionDocMediaSource } from "@/core/motion-doc/domain/mediaSource";

export type YouTubeEmbedOptions = {
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
};

const youtubeVideoIdPattern = /^[a-zA-Z0-9_-]{6,64}$/;

export function sanitizeMotionDocVideoSource(value: string) {
  const source = sanitizeMotionDocMediaSource(value);
  if (source.startsWith("blob:")) return "";
  if (source.startsWith("data:") && !source.toLowerCase().startsWith("data:video/")) return "";
  return source;
}

export function youtubeEmbedUrl(source: string, options: YouTubeEmbedOptions = {}) {
  const videoId = youtubeVideoId(source);

  if (!videoId) {
    return null;
  }

  const params = new URLSearchParams({
    controls: options.controls === false ? "0" : "1",
    playsinline: "1",
    rel: "0"
  });

  if (options.autoplay) {
    params.set("autoplay", "1");
  }

  if (options.muted) {
    params.set("mute", "1");
  }

  if (options.loop) {
    params.set("loop", "1");
    params.set("playlist", videoId);
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function youtubeVideoId(source: string) {
  try {
    const url = new URL(source.trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let candidate: string | null = null;

    if (hostname === "youtu.be") {
      candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      const segments = url.pathname.split("/").filter(Boolean);

      if (["embed", "live", "shorts"].includes(segments[0] ?? "")) {
        candidate = segments[1] ?? null;
      } else {
        candidate = url.searchParams.get("v");
      }
    } else if (hostname === "youtube-nocookie.com" || hostname.endsWith(".youtube-nocookie.com")) {
      const segments = url.pathname.split("/").filter(Boolean);
      candidate = segments[0] === "embed" ? segments[1] ?? null : null;
    }

    return candidate && youtubeVideoIdPattern.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}
