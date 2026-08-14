import type { TemplateBlueprintV1, TemplatePackageV1 } from "@/core/motion-doc/domain/templatePackageV1";

export const officialTemplatePackageVersion = "1.0.0";
export const officialTemplateCompatibility = { motionDoc: "1.0.0", openSlideX: "0.3.3" } as const;

export type OfficialTemplateDefinition = {
  blueprint: TemplateBlueprintV1;
  catalog: TemplatePackageV1["catalog"];
  cover: string;
  id: string;
  locales: TemplatePackageV1["locales"];
};

export const officialTemplateDefinitions: readonly OfficialTemplateDefinition[] = [
  {
    id: "summer-time-report",
    cover: "",
    catalog: {
      author: "OpenSlideX Contributors",
      category: "report",
      featured: true,
      slideCount: 7,
      sortOrder: 20,
      tags: ["Summer", "Report", "Seasonal", "Team"]
    },
    locales: {
      en: {
        description: "A bright seven-slide seasonal report for shared context, highlights, metrics, and next steps.",
        name: "Summer Time Report",
        useCase: "Seasonal recaps, team updates, and program reports"
      },
      "zh-TW": {
        description: "明亮的七頁季節報告，適合整理脈絡、亮點、指標與下一步。",
        name: "夏日時光報告",
        useCase: "季節回顧、團隊更新與計畫報告"
      }
    },
    blueprint: {
      schemaVersion: 1,
      narrative: {
        objective: "Turn a season of work into a clear recap with shared context, evidence, and next actions.",
        slideRoles: ["cover", "about", "highlights", "metrics", "timeline", "next-steps", "closing"]
      },
      design: {
        colorTokens: ["#38BDF8", "#0A84FF", "#223E53", "#FFBC90", "#F2FAFF", "#FFFFFF", "#0A2540"],
        composition: "Airy editorial layouts with a left-aligned text hierarchy, rounded metric surfaces, and simple seasonal geometric accents.",
        imageTreatment: "No images are required; preserve the editable circle, star, and geometric shape accents.",
        typography: "Large bold Arial headlines, concise labels, and high-contrast supporting copy."
      },
      imageSlots: [],
      layoutRoles: ["cover", "about", "highlights", "metrics", "timeline", "next-steps", "closing"],
      prohibitions: [
        "Do not depend on Cloud authentication or remote persistence.",
        "Do not use remote or Base64 media in local projects.",
        "Do not replace the editable seasonal shape accents with raster artwork."
      ],
      qaRules: [
        "Keep every visible element editable MotionDoc content.",
        "Preserve one clear reporting message per slide.",
        "Validate and render the deck before completion."
      ]
    }
  },
  definition("moodboard", "marketing", true, 60, 14, ["Moodboard", "Brand", "Creative Direction"], {
    en: { description: "A 14-slide visual direction deck exploring typography, imagery, motion, texture, and composition.", name: "Moodboard", useCase: "Brand direction, visual research, and creative concept alignment" },
    "zh-TW": { description: "以 14 頁探索字體、影像、動態、材質與構圖的視覺方向模板。", name: "情緒板", useCase: "品牌方向、視覺研究與創意概念對齊" }
  }, blueprint("Align a team on one coherent visual direction.", ["cover", "concept", "type", "palette", "imagery", "texture", "composition", "motion", "applications", "comparison", "principles", "system", "recommendation", "closing"], "Experimental editorial art direction with deliberate variation and a coherent visual world.", ["#111111", "#F5F0E8", "#D94B32", "#5C6CFF"], "Expressive display typography balanced by disciplined captions.", "Treat every image as material: crop, filter, sequence, and contrast consistently.", ["hero", "texture", "reference"]))
];

function definition(
  id: string,
  category: string,
  featured: boolean,
  sortOrder: number,
  slideCount: number,
  tags: string[],
  locales: TemplatePackageV1["locales"],
  blueprintValue: TemplateBlueprintV1
): OfficialTemplateDefinition {
  return {
    blueprint: blueprintValue,
    catalog: { author: "SlideX", category, featured, slideCount, sortOrder, tags },
    cover: "",
    id,
    locales
  };
}

function blueprint(
  objective: string,
  slideRoles: string[],
  composition: string,
  colorTokens: string[],
  typography: string,
  imageTreatment: string,
  imageRoles: string[]
): TemplateBlueprintV1 {
  return {
    design: { colorTokens, composition, imageTreatment, typography },
    imageSlots: imageRoles.map((role) => ({ aspectRatio: role === "hero" ? "16:9" : "4:3", required: false, role })),
    layoutRoles: [...new Set(slideRoles)],
    narrative: { objective, slideRoles },
    prohibitions: [
      "Do not execute template code or add unregistered components.",
      "Do not preserve remote image URLs or Base64 media in OpenSlideX projects.",
      "Do not repeat one generic card grid across the deck."
    ],
    qaRules: [
      "Keep every visible element editable MotionDoc content.",
      "Validate the complete source and inspect rendered slides before completion.",
      "Preserve readable contrast, safe margins, and one dominant focal point per slide."
    ],
    schemaVersion: 1
  };
}
