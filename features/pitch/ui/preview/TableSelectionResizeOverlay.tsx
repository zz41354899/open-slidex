"use client";

import type { CSSProperties, PointerEvent } from "react";
import type { TableSelection } from "@/core/motion-doc/application/tableBlock";
import { selectedTableTrackGeometry } from "@/features/pitch/application/tableTrackGeometry";

export function TableSelectionResizeOverlay({
  columnTracks,
  onResizeStart,
  rowTracks,
  selection
}: {
  columnTracks: number[];
  onResizeStart: (selection: TableSelection, event: PointerEvent<HTMLButtonElement>) => void;
  rowTracks: number[];
  selection: TableSelection;
}) {
  const isColumn = selection.kind === "column";
  const tracks = isColumn ? columnTracks : rowTracks;
  const geometry = selectedTableTrackGeometry(tracks, selection.index);
  const overlayStyle: CSSProperties = {
    background: "rgba(236,72,153,0.12)",
    border: "2px solid rgba(236,72,153,0.92)",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.62), 0 10px 24px rgba(236,72,153,0.22)",
    pointerEvents: "none",
    position: "absolute",
    zIndex: 24,
    ...(isColumn
      ? { bottom: 0, left: `${geometry.offset}%`, top: 0, width: `${geometry.size}%` }
      : { height: `${geometry.size}%`, left: 0, right: 0, top: `${geometry.offset}%` })
  };
  const handleStyle: CSSProperties = {
    background: "#ec4899",
    border: "1px solid rgba(255,255,255,0.82)",
    boxShadow: "0 8px 22px rgba(236,72,153,0.45)",
    cursor: isColumn ? "col-resize" : "row-resize",
    pointerEvents: "auto",
    position: "absolute",
    ...(isColumn
      ? { borderRadius: 999, height: 46, right: -6, top: "50%", transform: "translateY(-50%)", width: 10 }
      : { borderRadius: 999, bottom: -6, height: 10, left: "50%", transform: "translateX(-50%)", width: 46 })
  };

  return (
    <div style={overlayStyle}>
      {tracks.length > 1 ? (
        <button
          aria-label={isColumn ? `Resize column ${selection.index + 1}` : `Resize row ${selection.index + 1}`}
          className="appearance-none p-0"
          data-dot-field-pause
          onPointerDown={(event) => onResizeStart(selection, event)}
          style={handleStyle}
          type="button"
        />
      ) : null}
    </div>
  );
}
