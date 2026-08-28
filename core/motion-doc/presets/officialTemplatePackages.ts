import {
  officialTemplateCompatibility,
  officialTemplateDefinitions,
  officialTemplatePackageVersion,
  type OfficialTemplateDefinition
} from "@/core/motion-doc/domain/officialTemplateDefinitions";
import type { TemplatePackageLocale, TemplatePackageV1, TemplateRef } from "@/core/motion-doc/domain/templatePackageV1";
import { getBundledTemplateLibraryBlankSource, getBundledTemplateLibrarySource } from "@/core/motion-doc/presets/templateLibrarySources";

export const officialTemplatePackages: TemplatePackageV1[] = officialTemplateDefinitions.map(createPackage);

export function getOfficialTemplatePackage(id: string, version = officialTemplatePackageVersion) {
  return version === officialTemplatePackageVersion
    ? officialTemplatePackages.find((template) => template.id === id)
    : undefined;
}

export function getOfficialTemplateRef(id: string, locale: TemplatePackageLocale): TemplateRef | undefined {
  return getOfficialTemplatePackage(id) ? { id, locale, version: officialTemplatePackageVersion } : undefined;
}

function createPackage(item: OfficialTemplateDefinition): TemplatePackageV1 {
  const sourceEn = getBundledTemplateLibrarySource(item.id, "en");
  const sourceZhTw = getBundledTemplateLibrarySource(item.id, "zh-TW");
  const starterEn = getBundledTemplateLibraryBlankSource(item.id, "en");
  const starterZhTw = getBundledTemplateLibraryBlankSource(item.id, "zh-TW");
  if (!sourceEn || !sourceZhTw || !starterEn || !starterZhTw) {
    throw new Error(`Public template source is missing: ${item.id}`);
  }
  return {
    assets: item.assets,
    blueprint: item.blueprint,
    catalog: item.catalog,
    compatibility: officialTemplateCompatibility,
    cover: { alt: { en: `${item.locales.en.name} cover`, "zh-TW": `${item.locales["zh-TW"].name}封面` }, source: item.cover || "about:blank" },
    id: item.id,
    kind: "open-slidex-template",
    locales: item.locales,
    schemaVersion: 1,
    sources: { en: sourceEn, "zh-TW": sourceZhTw },
    starterSources: { en: starterEn, "zh-TW": starterZhTw },
    version: officialTemplatePackageVersion
  };
}
