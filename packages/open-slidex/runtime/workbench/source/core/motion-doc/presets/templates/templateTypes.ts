export type MotionTemplateLocale = "en" | "zh-TW";

export type MotionTemplate = {
  id: string;
  name: string;
  category: string;
  duration: string;
  description: string;
  useCase: string;
  source: string;
  sources: Record<MotionTemplateLocale, string>;
};
