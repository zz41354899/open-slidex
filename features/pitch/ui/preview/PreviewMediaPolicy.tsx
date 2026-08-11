"use client";

import { createContext, useContext, type ReactNode } from "react";
import { isOpenSlideXLocalAssetSource } from "@/core/motion-doc/application/localMediaPolicy";

const PreviewMediaPolicyContext = createContext({
  chartMotionMode: "animated" as "animated" | "editor-static",
  localAssetsOnly: false,
  responsiveCharts: false
});

export function PreviewMediaPolicyProvider({ animateCharts = false, children, localAssetsOnly }: {
  animateCharts?: boolean;
  children: ReactNode;
  localAssetsOnly: boolean;
}) {
  return (
    <PreviewMediaPolicyContext.Provider value={{
      chartMotionMode: localAssetsOnly && !animateCharts ? "editor-static" : "animated",
      localAssetsOnly,
      responsiveCharts: localAssetsOnly
    }}>
      {children}
    </PreviewMediaPolicyContext.Provider>
  );
}

/** Returns an empty source when Local Workbench encounters legacy remote media. */
export function usePreviewMediaSource(source: string | undefined) {
  const { localAssetsOnly } = useContext(PreviewMediaPolicyContext);
  const value = source?.trim() ?? "";
  if (!localAssetsOnly || !value || isOpenSlideXLocalAssetSource(value)) return value;
  return "";
}

export function usePreviewRenderPolicy() {
  return useContext(PreviewMediaPolicyContext);
}
