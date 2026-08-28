import type { MotionTemplate } from "@/core/motion-doc/presets/templates/templateTypes";

import { moodboardTemplate } from "@/core/motion-doc/presets/templates/moodboard";
import { churchPresentationTemplateSource } from "@/core/motion-doc/presets/templates/churchPresentation";
import { planetaryMorphTemplateSource } from "@/core/motion-doc/presets/templates/planetaryMorph";

export type { MotionTemplate } from "@/core/motion-doc/presets/templates/templateTypes";
export { snippetTemplates } from "@/core/motion-doc/presets/templates/snippetTemplates";

export const motionTemplates: MotionTemplate[] = [
  moodboardTemplate,
  {
    category: "Science & Education",
    description: "A four-slide interactive planetary tour that uses Shared Morph for overview-to-detail navigation.",
    duration: "20s",
    id: "planetary-morph",
    name: "Planetary Morph",
    source: planetaryMorphTemplateSource,
    sources: { en: planetaryMorphTemplateSource, "zh-TW": planetaryMorphTemplateSource },
    useCase: "Science lessons, astronomy explainers, and interactive concept tours"
  },
  {
    category: "Community",
    description: "A thirteen-slide browser-native church presentation with expressive type and projection-ready playback.",
    duration: "65s",
    id: "church-presentation",
    name: "Church Presentation",
    source: churchPresentationTemplateSource,
    sources: { en: churchPresentationTemplateSource, "zh-TW": churchPresentationTemplateSource },
    useCase: "Church services, worship gatherings, and community welcomes"
  }
];
export const defaultTemplate: MotionTemplate | undefined = motionTemplates[0];
