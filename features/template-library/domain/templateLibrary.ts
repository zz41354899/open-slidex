import { officialTemplateDefinitions } from "@/core/motion-doc/domain/officialTemplateDefinitions";

export type TemplateLibraryLocale = "zh-TW" | "en";
export type TemplateLibraryCategoryId = "getting-started" | "marketing" | "people" | "pitch" | "product" | "proposal" | "report" | "sales" | "strategy";
export type TemplateLibraryFilterId = "all" | TemplateLibraryCategoryId;
export type TemplateLibraryAuthor = { kind: "official" | "curated"; name: string };
export type TemplateLibraryItem = {
  author: TemplateLibraryAuthor;
  category: TemplateLibraryCategoryId;
  description: string;
  featured: boolean;
  id: string;
  name: string;
  slideCount: number;
  slug: string;
  sortOrder: number;
  tags: readonly string[];
  useCase: string;
};

const categoryLabels: Record<TemplateLibraryFilterId, Record<TemplateLibraryLocale, string>> = {
  all: { en: "All templates", "zh-TW": "所有模板" },
  "getting-started": { en: "Getting started", "zh-TW": "快速開始" },
  marketing: { en: "Marketing", "zh-TW": "行銷" },
  people: { en: "People", "zh-TW": "人才與團隊" },
  pitch: { en: "Pitch", "zh-TW": "募資簡報" },
  product: { en: "Product", "zh-TW": "產品" },
  proposal: { en: "Proposal", "zh-TW": "提案" },
  report: { en: "Report", "zh-TW": "報告" },
  sales: { en: "Sales", "zh-TW": "銷售" },
  strategy: { en: "Strategy", "zh-TW": "策略" }
};

export function getTemplateLibraryItems(locale: TemplateLibraryLocale): TemplateLibraryItem[] {
  return officialTemplateDefinitions.map((template) => ({
    author: { kind: "official" as const, name: template.catalog.author },
    category: template.catalog.category as TemplateLibraryCategoryId,
    description: template.locales[locale].description,
    featured: template.catalog.featured,
    id: template.id,
    name: template.locales[locale].name,
    slideCount: template.catalog.slideCount,
    slug: template.id,
    sortOrder: template.catalog.sortOrder,
    tags: template.catalog.tags,
    useCase: template.locales[locale].useCase
  })).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getTemplateLibraryItemBySlug(slug: string, locale: TemplateLibraryLocale) {
  return getTemplateLibraryItems(locale).find((item) => item.slug === slug);
}

export function getTemplateLibraryItemById(id: string, locale: TemplateLibraryLocale) {
  return getTemplateLibraryItems(locale).find((item) => item.id === id);
}

export function getTemplateLibraryCategoryLabel(category: TemplateLibraryFilterId, locale: TemplateLibraryLocale) {
  return categoryLabels[category][locale];
}

export function getTemplateLibraryCategories(locale: TemplateLibraryLocale) {
  const items = getTemplateLibraryItems(locale);
  return [{ count: items.length, id: "all" as const, label: getTemplateLibraryCategoryLabel("all", locale) }];
}

export function templateLibraryCoverPath(slug: string, slideIndex = 0, locale: TemplateLibraryLocale = "en") {
  const safeSlideIndex = Math.max(0, Math.floor(slideIndex));
  return `/api/v1/templates/${encodeURIComponent(slug)}/cover.svg?slide=${safeSlideIndex}&locale=${encodeURIComponent(locale)}`;
}
