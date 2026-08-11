"use client";

import type { PointerEvent } from "react";
import type { TableSelection } from "@/core/motion-doc/application/tableBlock";

type TableTrackResizeGuidesProps = {
  columnTracks: number[];
  onResizeStart: (selection: TableSelection, event: PointerEvent<HTMLButtonElement>) => void;
  rowTracks: number[];
};

export function TableTrackResizeGuides({ columnTracks, onResizeStart, rowTracks }: TableTrackResizeGuidesProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[23]">
      {columnTracks.slice(0, -1).map((_, index) => {
        const position = trackEndPosition(columnTracks, index);
        return (
          <button
            aria-label={`Resize column ${index + 1}`}
            className="pointer-events-auto absolute bottom-0 top-0 w-3 -translate-x-1/2 cursor-col-resize border-0 bg-transparent p-0 outline-none after:absolute after:bottom-0 after:left-1/2 after:top-0 after:w-px after:-translate-x-1/2 after:bg-pink-400/25 after:transition-all hover:after:w-[3px] hover:after:bg-pink-400/70 focus-visible:after:w-[3px] focus-visible:after:bg-pink-400/80"
            data-dot-field-pause
            key={`column-resize-guide-${index}`}
            onPointerDown={(event) => onResizeStart({ index, kind: "column" }, event)}
            style={{ left: `${position}%` }}
            type="button"
          />
        );
      })}
      {rowTracks.slice(0, -1).map((_, index) => {
        const position = trackEndPosition(rowTracks, index);
        return (
          <button
            aria-label={`Resize row ${index + 1}`}
            className="pointer-events-auto absolute left-0 right-0 h-3 -translate-y-1/2 cursor-row-resize border-0 bg-transparent p-0 outline-none after:absolute after:left-0 after:right-0 after:top-1/2 after:h-px after:-translate-y-1/2 after:bg-pink-400/25 after:transition-all hover:after:h-[3px] hover:after:bg-pink-400/70 focus-visible:after:h-[3px] focus-visible:after:bg-pink-400/80"
            data-dot-field-pause
            key={`row-resize-guide-${index}`}
            onPointerDown={(event) => onResizeStart({ index, kind: "row" }, event)}
            style={{ top: `${position}%` }}
            type="button"
          />
        );
      })}
    </div>
  );
}

function trackEndPosition(tracks: number[], index: number) {
  const total = tracks.reduce((sum, value) => sum + Math.max(value, 0), 0) || 1;
  const end = tracks.slice(0, index + 1).reduce((sum, value) => sum + Math.max(value, 0), 0);
  return (end / total) * 100;
}
