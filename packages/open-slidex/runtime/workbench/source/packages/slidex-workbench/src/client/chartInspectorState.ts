import type { MotionDocBlock, MotionDocChartDatum, MotionDocProps } from "@open-slidex/sdk";

export function clearChartDatumColors(rows: MotionDocChartDatum[]) {
  return rows.map(withoutDatumColor);
}

export function mergeChartProps(block: MotionDocBlock, patch: MotionDocProps): MotionDocProps {
  return { ...block.props, ...patch };
}

export function withoutDatumColor(row: MotionDocChartDatum): MotionDocChartDatum {
  const { color: _color, ...rest } = row;
  return rest;
}
