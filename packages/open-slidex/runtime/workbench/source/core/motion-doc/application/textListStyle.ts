import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

export type MotionDocTextListType = "" | "bullet" | "ordered";

export function applyTextListStyle(
  props: MotionDocProps,
  text: string,
  listType: MotionDocTextListType
) {
  const currentListType = props.listType === "bullet" || props.listType === "ordered"
    ? props.listType
    : "";
  const nextProps = { ...props };
  const nextText = currentListType
    ? stripLegacyListMarkers(text, currentListType)
    : text;

  delete nextProps.listType;
  if (listType) nextProps.listType = listType;
  if (listType !== "ordered") delete nextProps.listStart;

  return { props: nextProps, text: nextText };
}

function stripLegacyListMarkers(text: string, listType: Exclude<MotionDocTextListType, "">) {
  const marker = listType === "bullet"
    ? /^\s*[•▪◦]\s+/
    : /^\s*\d+[.)、]\s+/;
  return text.split("\n").map((line) => line.replace(marker, "")).join("\n");
}
