
import { createContext, useContext, type ReactNode } from "react";
import { isOpenSlideXCompatibleMediaSource, isOpenSlideXLocalAssetSource } from "@/core/motion-doc/application/localMediaPolicy";

const PreviewMediaPolicyContext = createContext({
  assetUrl: (source: string) => source,
  chartMotionMode: "animated" as "animated" | "editor-static",
  localAssetsOnly: false,
  responsiveCharts: false
});

export function PreviewMediaPolicyProvider({ assetUrl = (source) => source, animateCharts = false, children, localAssetsOnly }: {
  assetUrl?: (source: string) => string;
  animateCharts?: boolean;
  children: ReactNode;
  localAssetsOnly: boolean;
}) {
  return (
    <PreviewMediaPolicyContext.Provider value={{
      assetUrl,
      chartMotionMode: localAssetsOnly && !animateCharts ? "editor-static" : "animated",
      localAssetsOnly,
      responsiveCharts: localAssetsOnly
    }}>
      {children}
    </PreviewMediaPolicyContext.Provider>
  );
}

/** Resolves local assets through the workbench and retains safe direct HTTPS media. */
export function usePreviewMediaSource(source: string | undefined) {
  const { assetUrl, localAssetsOnly } = useContext(PreviewMediaPolicyContext);
  const value = source?.trim() ?? "";
  if (!localAssetsOnly || !value) return value;
  if (isOpenSlideXLocalAssetSource(value)) return assetUrl(value);
  return isOpenSlideXCompatibleMediaSource(value) ? value : "";
}

export function usePreviewRenderPolicy() {
  return useContext(PreviewMediaPolicyContext);
}
