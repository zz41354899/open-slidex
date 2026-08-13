export const assistantCanvasTones = ["lime", "periwinkle"] as const;

export type AssistantCanvasTone = (typeof assistantCanvasTones)[number];
