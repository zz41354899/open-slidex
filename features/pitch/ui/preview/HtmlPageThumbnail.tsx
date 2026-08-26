import { useEffect, useMemo, useState } from "react";
import { usePreviewRenderPolicy } from "@/features/pitch/ui/preview/PreviewMediaPolicy";

export function HtmlPageThumbnail({ eager = false, page, source }: {
  eager?: boolean;
  page: number;
  source: string;
}) {
  const { assetUrl, localAssetsOnly } = usePreviewRenderPolicy();
  const [failed, setFailed] = useState(false);
  const thumbnail = useMemo(() => {
    if (!localAssetsOnly || !/^assets\/[A-Za-z0-9._-]+\.html?$/i.test(source)) return "";
    return htmlPageThumbnailSource(assetUrl(source), source, page, window.location.href);
  }, [assetUrl, localAssetsOnly, page, source]);

  useEffect(() => setFailed(false), [thumbnail]);

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_68%_18%,rgba(105,123,255,0.22),transparent_42%),linear-gradient(145deg,#171923_0%,#090a0e_70%)]"
      data-html-page-thumbnail
    >
      {thumbnail && !failed ? (
        <img
          alt=""
          className="h-full w-full object-cover"
          decoding="async"
          draggable={false}
          fetchPriority={eager ? "high" : "low"}
          loading={eager ? "eager" : "lazy"}
          onError={() => setFailed(true)}
          src={thumbnail}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="rounded border border-white/[0.14] bg-white/[0.06] px-2 py-1 text-[8px] font-semibold tracking-[0.16em] text-white/55">HTML</span>
        </div>
      )}
    </div>
  );
}

export function htmlPageThumbnailSource(resolvedAssetUrl: string, source: string, page: number, baseUrl: string) {
  const url = new URL(resolvedAssetUrl, baseUrl);
  const marker = "/assets/";
  const assetIndex = url.pathname.lastIndexOf(marker);
  if (assetIndex < 0) return "";
  url.pathname = `${url.pathname.slice(0, assetIndex)}/api/v1/assets/html-thumbnail`;
  url.search = new URLSearchParams({
    page: String(Math.max(1, Math.floor(Number.isFinite(page) ? page : 1))),
    renderVersion: "3",
    source
  }).toString();
  url.hash = "";
  return url.toString();
}
