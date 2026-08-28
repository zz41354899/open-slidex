import type { TemplateBlueprintV1, TemplatePackageV1 } from "@/core/motion-doc/domain/templatePackageV1";

export const officialTemplatePackageVersion = "1.0.0";
export const officialTemplateCompatibility = { motionDoc: "1.0.0", openSlideX: "0.3.6" } as const;

export type OfficialTemplateDefinition = {
  assets: TemplatePackageV1["assets"];
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
    assets: [],
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
  }, blueprint("Align a team on one coherent visual direction.", ["cover", "concept", "type", "palette", "imagery", "texture", "composition", "motion", "applications", "comparison", "principles", "system", "recommendation", "closing"], "Experimental editorial art direction with deliberate variation and a coherent visual world.", ["#111111", "#F5F0E8", "#D94B32", "#5C6CFF"], "Expressive display typography balanced by disciplined captions.", "Treat every image as material: crop, filter, sequence, and contrast consistently.", ["hero", "texture", "reference"])),
  definition("planetary-morph", "education", true, 30, 4, ["Space", "Science", "Morph", "Interactive"], {
    en: { description: "A four-slide interactive planetary tour that uses Shared Morph to move from an overview to focused planet details.", name: "Planetary Morph", useCase: "Science lessons, astronomy explainers, and interactive concept tours" },
    "zh-TW": { description: "以 Shared Morph 從行星總覽延展到個別介紹的四頁互動天文模板。", name: "行星轉場導覽", useCase: "科學課程、天文解說與互動式概念導覽" }
  }, blueprint("Let an audience explore a small set of related scientific concepts through an overview and focused details.", ["overview", "detail", "detail", "detail"], "A dark deep-space field with three evenly spaced circular planet portals and a focused two-column detail composition.", ["#000000", "#38BDF8", "#EF4444", "#F59E0B", "#F7F7F5"], "High-contrast sans-serif labels with large, concise detail titles.", "Use full-bleed astronomical imagery inside circular crops over one consistent deep-space background.", ["planet", "background"]), [
    { bytes: 19768, mediaType: "image/webp", path: "assets/planetarium-space-background-bf33da3348efa85f.webp", sha256: "bf33da3348efa85fe3024d0392b0fecefe78ac88584591bfc6ba2c5d60a8e2db" },
    { bytes: 7332, mediaType: "image/webp", path: "assets/Uranus_Voyager2_color_calibrated-ea1eab40a19cef79.webp", sha256: "ea1eab40a19cef79ef25b4cac3f43e4ccf74a39691807f222a3e3a390e4af6ca" },
    { bytes: 15228, mediaType: "image/webp", path: "assets/images-cd6a8220608c3941.webp", sha256: "cd6a8220608c39411aff7d8f1f1e5fde4015803b10d54962ceb2a78d0a26b644" },
    { bytes: 11518, mediaType: "image/webp", path: "assets/images-1-d642064a78014f16.webp", sha256: "d642064a78014f16fd31d85a6f63e16f160eb65c39be081a39d6fd5d3fd4837c" }
  ]),
  definition("church-presentation", "community", true, 40, 13, ["Church", "Worship", "HTML", "Welcome"], {
    en: { description: "A thirteen-slide browser-native church presentation with expressive type, animated texture, and projection-ready playback.", name: "Church Presentation", useCase: "Church services, worship gatherings, and community welcomes" },
    "zh-TW": { description: "具表現力字體、動態材質與投影播放能力的十三頁瀏覽器原生教會簡報模板。", name: "教會簡報", useCase: "教會聚會、敬拜活動與社群歡迎簡報" }
  }, blueprint("Create an immersive welcome and message sequence for a live community gathering.", ["welcome", "message", "message", "message", "message", "message", "message", "message", "message", "message", "message", "message", "closing"], "Full-bleed browser-native canvas with theatrical typography, textured motion backgrounds, and projection-first spacing.", ["#000000", "#F8F0E6", "#6D63FF", "#261522"], "Bebas Neue display text paired with expressive script accents and high-contrast support copy.", "Preserve the browser-native HTML stage and its local playback behaviors; it is intentionally not converted to editable MotionDoc layers.", ["background", "type-treatment"]), [
    { bytes: 435103, mediaType: "text/html", path: "assets/source-5ad7b364e098eba0.html", sha256: "5ad7b364e098eba0156b211f4c9fab6fe997e7fca98ca032badf3e56ffca32e5" }
  ])
];

function definition(
  id: string,
  category: string,
  featured: boolean,
  sortOrder: number,
  slideCount: number,
  tags: string[],
  locales: TemplatePackageV1["locales"],
  blueprintValue: TemplateBlueprintV1,
  assets: TemplatePackageV1["assets"] = []
): OfficialTemplateDefinition {
  return {
    assets,
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
