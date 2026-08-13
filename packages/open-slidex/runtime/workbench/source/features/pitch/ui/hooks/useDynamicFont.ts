
import { useEffect } from "react";
import { getGoogleFontUrl } from "@/features/pitch/application/googleFonts";

const loadedFonts = new Set<string>();

export function useDynamicFont(fontFamily: string | undefined | null) {
  useDynamicFonts(fontFamily ? [fontFamily] : []);
}

export function useDynamicFonts(fontFamilies: readonly string[]) {
  const fontKey = [...new Set(fontFamilies.filter(Boolean))].sort().join("\n");

  useEffect(() => {
    if (!fontKey || typeof document === "undefined") return;

    fontKey.split("\n").forEach((fontFamily) => {
      const url = getGoogleFontUrl(fontFamily);
      if (!url || loadedFonts.has(fontFamily)) return;
      const existingLink = document.querySelector(`link[href="${url}"]`);
      if (existingLink) {
        loadedFonts.add(fontFamily);
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      document.head.appendChild(link);
      loadedFonts.add(fontFamily);
    });
  }, [fontKey]);
}
