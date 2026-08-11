import type { TemplateBlueprintV1, TemplatePackageV1 } from "@/core/motion-doc/domain/templatePackageV1";

export const officialTemplatePackageVersion = "1.0.0";
export const officialTemplateCompatibility = { motionDoc: "1.0.0", openSlideX: "0.2.4" } as const;

export type OfficialTemplateDefinition = {
  blueprint: TemplateBlueprintV1;
  catalog: TemplatePackageV1["catalog"];
  cover: string;
  id: string;
  locales: TemplatePackageV1["locales"];
};

export const officialTemplateDefinitions: readonly OfficialTemplateDefinition[] = [
  {
    id: "open-slidex-starter",
    cover: "",
    catalog: {
      author: "OpenSlideX Contributors",
      category: "getting-started",
      featured: true,
      slideCount: 2,
      sortOrder: 10,
      tags: ["OpenSlideX", "Starter", "Local"]
    },
    locales: {
      en: {
        description: "A neutral two-slide starting point for a local presentation.",
        name: "OpenSlideX Starter",
        useCase: "New local decks and quick experiments"
      },
      "zh-TW": {
        description: "一份中性的兩頁本機簡報起點。",
        name: "OpenSlideX 起始範例",
        useCase: "建立本機簡報與快速實驗"
      }
    },
    blueprint: {
      schemaVersion: 1,
      narrative: {
        objective: "Turn one clear point into an actionable presentation.",
        slideRoles: ["cover", "next-steps"]
      },
      design: {
        colorTokens: ["#111827", "#F8FAFC", "#A7F3D0", "#0F766E"],
        composition: "Clear editorial hierarchy with one focal point per slide.",
        imageTreatment: "Images are optional; prefer editable shapes for the starter.",
        typography: "Large concise titles with restrained supporting copy."
      },
      imageSlots: [],
      layoutRoles: ["cover", "next-steps"],
      prohibitions: [
        "Do not depend on Cloud authentication or remote persistence.",
        "Do not use remote or Base64 media in local projects."
      ],
      qaRules: [
        "Keep every visible element editable MotionDoc content.",
        "Validate and render the deck before completion."
      ]
    }
  }
];
