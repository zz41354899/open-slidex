import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

export const INTERACTION_PROP = "interaction";

export type InteractionActionV1 =
  | { type: "nextSlide" }
  | { type: "previousSlide" }
  | { slide: number; type: "goToSlide" }
  | { type: "openUrl"; url: string };

export type InteractionV1 = {
  action: InteractionActionV1;
  trigger: "click";
  version: 1;
};

export function parseInteraction(value: unknown): { interaction: InteractionV1 | null; issues: string[] } {
  if (value === undefined || value === null || value === "") return { interaction: null, issues: [] };
  if (typeof value !== "string") return { interaction: null, issues: ["interaction must be a JSON string."] };
  let candidate: unknown;
  try { candidate = JSON.parse(value); } catch { return { interaction: null, issues: ["interaction must contain valid JSON."] }; }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return { interaction: null, issues: ["interaction must be an object."] };
  const record = candidate as Record<string, unknown>;
  if (record.version !== 1) return { interaction: null, issues: ["interaction.version must be 1."] };
  if (record.trigger !== "click") return { interaction: null, issues: ["interaction.trigger must be click."] };
  if (!record.action || typeof record.action !== "object" || Array.isArray(record.action)) return { interaction: null, issues: ["interaction.action must be an object."] };
  const action = record.action as Record<string, unknown>;
  if (action.type === "nextSlide" || action.type === "previousSlide") {
    return { interaction: { action: { type: action.type }, trigger: "click", version: 1 }, issues: [] };
  }
  if (action.type === "goToSlide") {
    if (!Number.isInteger(action.slide) || Number(action.slide) < 1) return { interaction: null, issues: ["goToSlide.slide must be a positive 1-based slide number."] };
    return { interaction: { action: { slide: Number(action.slide), type: "goToSlide" }, trigger: "click", version: 1 }, issues: [] };
  }
  if (action.type === "openUrl") {
    const url = typeof action.url === "string" ? action.url.trim() : "";
    if (!isSafeInteractionUrl(url)) return { interaction: null, issues: ["openUrl.url must use https, http, mailto, or a local hash."] };
    return { interaction: { action: { type: "openUrl", url }, trigger: "click", version: 1 }, issues: [] };
  }
  return { interaction: null, issues: ["interaction.action.type is not supported."] };
}

export function interactionFromProps(props: MotionDocProps) {
  return parseInteraction(props[INTERACTION_PROP]).interaction;
}

export function withInteraction(props: MotionDocProps, interaction: InteractionV1 | null): MotionDocProps {
  const next = { ...props };
  if (interaction) next[INTERACTION_PROP] = JSON.stringify(interaction);
  else delete next[INTERACTION_PROP];
  return next;
}

export function isSafeInteractionUrl(value: string) {
  if (value.startsWith("#")) return value.length > 1;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}
