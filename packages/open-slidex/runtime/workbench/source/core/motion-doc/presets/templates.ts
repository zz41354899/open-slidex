import type { MotionTemplate } from "@/core/motion-doc/presets/templates/templateTypes";

import { moodboardTemplate } from "@/core/motion-doc/presets/templates/moodboard";

export type { MotionTemplate } from "@/core/motion-doc/presets/templates/templateTypes";
export { snippetTemplates } from "@/core/motion-doc/presets/templates/snippetTemplates";

export const motionTemplates: MotionTemplate[] = [
  moodboardTemplate
];
export const defaultTemplate: MotionTemplate | undefined = motionTemplates[0];
