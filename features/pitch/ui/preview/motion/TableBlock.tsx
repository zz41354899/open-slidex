"use client";

import { type CSSProperties } from "react";
import type { MotionDocTableBlock } from "@/core/motion-doc/domain/motionDocTypes";
import {
  MOTION_DOC_FONT_SIZES,
  motionDocFontPointsToCanvasPixels
} from "@/core/motion-doc/domain/typography";
import {
  parseColOverrides,
  parseRowOverrides,
  tableCellsFromProps,
  tableColumnTrackValuesFromProps,
  tableRowTrackValuesFromProps,
  tableSizeFromProps,
  tableTrackTemplate,
} from "@/core/motion-doc/application/tableBlock";
import { MotionBlock, type AnimationProps, type RadiusProps } from "@/features/pitch/ui/preview/motion/MotionBlock";
import { cssColor } from "@/features/pitch/ui/preview/motion/blockStyles";

export function TableBlock({
  fillFrame,
  props,
  ...animation
}: AnimationProps & RadiusProps & {
  fillFrame?: boolean;
  props: MotionDocTableBlock["props"];
}) {
  const { columns, rows } = tableSizeFromProps(props);
  const cells = tableCellsFromProps(props, rows, columns);
  const columnTracks = tableColumnTrackValuesFromProps(props, columns);
  const rowTracks = tableRowTrackValuesFromProps(props, rows);
  const borderWidth = numberFromProp(props.borderWidth, 1);
  const borderStyle = tableBorderStyle(props.borderStyle);
  const textAlign = textAlignValue(props.textAlign);
  const rootStyle = tableRootStyle(props, fillFrame);
  const gridStyle: CSSProperties = {
    gridTemplateColumns: tableTrackTemplate(columnTracks),
    gridTemplateRows: tableTrackTemplate(rowTracks)
  };
  const cellBaseStyle = tableCellStyle(props, borderWidth, borderStyle, textAlign);
  const rowOverrides = parseRowOverrides(props);
  const colOverrides = parseColOverrides(props);

  return (
    <MotionBlock
      className="w-full max-w-3xl overflow-hidden rounded-xl border shadow-xl shadow-black/20 backdrop-blur"
      fillFrame={fillFrame}
      radius={props.radius}
      style={rootStyle}
      {...animation}
    >
      <div className="grid h-full min-h-0 w-full" style={gridStyle}>
        {cells.flatMap((row, rowIndex) =>
          row.map((cell, columnIndex) => {
            const rowOv = rowOverrides[rowIndex];
            const colOv = colOverrides[columnIndex];
            const cellBg = rowOv?.background || colOv?.background || tableCellBackground(props, rowIndex);
            const cellBorderColor = rowOv?.borderColor || colOv?.borderColor || undefined;
            const cellTextColor = rowOv?.textColor || colOv?.textColor || undefined;
            const cellFontSize = rowOv?.fontSize ?? colOv?.fontSize;
            const cellFontWeight = rowOv?.fontWeight ?? colOv?.fontWeight;
            const cellFontFamily = rowOv?.fontFamily ?? colOv?.fontFamily;
            const cellTextAlign = rowOv?.textAlign ?? colOv?.textAlign;
            const borderOverride = cellBorderColor
              ? { borderBottom: `${borderWidth}px solid ${cellBorderColor}`, borderRight: `${borderWidth}px solid ${cellBorderColor}` }
              : {};

            return (
              <div
                className="min-w-0 overflow-hidden"
                key={`cell-${rowIndex}-${columnIndex}`}
                style={{
                  ...cellBaseStyle,
                  ...borderOverride,
                  background: cellBg,
                  color: cellTextColor || tableColor(props.color ?? props.textColor, "#000000"),
                  ...(cellFontFamily ? { fontFamily: cellFontFamily } : {}),
                  ...(cellFontSize === undefined ? {} : { fontSize: fontSizeValue(cellFontSize) }),
                  ...(cellFontWeight === undefined ? {} : { fontWeight: cellFontWeight }),
                  ...(cellTextAlign ? {
                    justifyContent: justifyValue(cellTextAlign),
                    textAlign: cellTextAlign
                  } : {})
                }}
              >
                <span className="min-w-0 whitespace-pre-wrap break-words">{cell || "\u00A0"}</span>
              </div>
            );
          })
        )}
      </div>
    </MotionBlock>
  );
}

function tableRootStyle(props: MotionDocTableBlock["props"], fillFrame: boolean | undefined): CSSProperties {
  const background = tableColor(props.background ?? props.backgroundColor ?? props.bg, "#ffffff");
  const color = tableColor(props.color ?? props.textColor, "#000000");
  const borderColor = tableColor(props.borderColor, "#d1d5db");

  return {
    background,
    borderColor,
    borderStyle: tableBorderStyle(props.borderStyle),
    color,
    ...(fillFrame ? { minHeight: 0 } : {})
  };
}

function tableCellStyle(props: MotionDocTableBlock["props"], borderWidth: number, borderStyle: "dashed" | "dotted" | "solid", textAlign: "center" | "left" | "right"): CSSProperties {
  return {
    alignItems: verticalAlignValue(props.textVerticalAlign),
    borderBottom: `${borderWidth}px ${borderStyle} ${tableColor(props.borderColor, "#d1d5db")}`,
    borderRight: `${borderWidth}px ${borderStyle} ${tableColor(props.borderColor, "#d1d5db")}`,
    display: "flex",
    fontSize: fontSizeValue(props.fontSize),
    justifyContent: justifyValue(textAlign),
    lineHeight: 1.25,
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
    padding: `${numberFromProp(props.cellPaddingY, 8)}px ${numberFromProp(props.cellPaddingX, 10)}px`,
    textAlign
  };
}

function tableBorderStyle(value: string | number | undefined): "dashed" | "dotted" | "solid" {
  return value === "dashed" || value === "dotted" ? value : "solid";
}

function tableCellBackground(props: MotionDocTableBlock["props"], rowIndex: number) {
  const stripeBackground = typeof props.stripeBackground === "string" && props.stripeBackground.trim()
    ? props.stripeBackground
    : "";

  if (stripeBackground && rowIndex % 2 === 1) {
    return tableColor(stripeBackground, "rgba(17,24,39,0.04)");
  }

  return tableColor(props.cellBackground, "#ffffff");
}

function tableColor(value: string | number | undefined, fallback: string) {
  return typeof value === "string" ? cssColor(value) ?? fallback : fallback;
}

function numberFromProp(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? Math.max(parsed, 0) : fallback;
}

function fontSizeValue(value: string | number | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  const points = Number.isFinite(parsed) ? Math.max(parsed, 1) : MOTION_DOC_FONT_SIZES.table;

  return `${motionDocFontPointsToCanvasPixels(points)}px`;
}

function textAlignValue(value: string | number | undefined) {
  if (value === "center" || value === "right") {
    return value;
  }

  return "left";
}

function verticalAlignValue(value: string | number | undefined) {
  if (value === "bottom") {
    return "flex-end";
  }

  if (value === "middle" || value === "center") {
    return "center";
  }

  return "flex-start";
}

function justifyValue(value: "center" | "left" | "right") {
  if (value === "center") {
    return "center";
  }

  if (value === "right") {
    return "flex-end";
  }

  return "flex-start";
}
