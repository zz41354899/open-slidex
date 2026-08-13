import type { TableSelection } from "@/core/motion-doc/application/tableBlock";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

const tableSelectionKindProp = "_tableSelectionKind";
const tableSelectionIndexProp = "_tableSelectionIndex";

export function tableEditorSelectionFromProps(props: MotionDocProps): TableSelection | null {
  const kind = props[tableSelectionKindProp];
  const index = numberFromProp(props[tableSelectionIndexProp]);

  if ((kind !== "row" && kind !== "column") || index === undefined) {
    return null;
  }

  return { index, kind };
}

export function tableEditorSelectionProps(props: MotionDocProps, selection: TableSelection | null): MotionDocProps {
  const nextProps = clearTableEditorSelectionProps(props);

  if (!selection) {
    return nextProps;
  }

  nextProps[tableSelectionKindProp] = selection.kind;
  nextProps[tableSelectionIndexProp] = selection.index;
  return nextProps;
}

export function clearTableEditorSelectionProps(props: MotionDocProps): MotionDocProps {
  const nextProps = { ...props };
  delete nextProps[tableSelectionKindProp];
  delete nextProps[tableSelectionIndexProp];
  return nextProps;
}

function numberFromProp(value: string | number | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return Math.floor(parsed);
}
