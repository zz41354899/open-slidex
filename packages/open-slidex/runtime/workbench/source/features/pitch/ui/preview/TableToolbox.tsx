
import { useState } from "react";
import { columnLabel, createTableCells, serializeTableCells } from "@/core/motion-doc/application/tableBlock";
import { MOTION_DOC_FONT_SIZES } from "@/core/motion-doc/domain/typography";
import type { AddBlockOptions } from "@/features/pitch/application/motionDocCommands";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import type { AddBlockType } from "@/features/pitch/ui/pitchOptions";

const compactTableGridSize = 5;
const maximumTableGridSize = 10;

export function TableToolbox({
  onAddTool
}: {
  onAddTool: (type: AddBlockType, options?: AddBlockOptions) => void;
}) {
  const { locale, tx } = usePitchI18n();
  const [expanded, setExpanded] = useState(false);
  const [hoveredSize, setHoveredSize] = useState<{ columns: number; rows: number } | null>(null);
  const tableGridSize = expanded ? maximumTableGridSize : compactTableGridSize;
  const panelWidth = expanded ? "w-[248px]" : "w-[220px]";

  function toggleExpandedGrid() {
    setExpanded((current) => !current);
    setHoveredSize(null);
  }

  function addTable(rows: number, columns: number) {
    onAddTool("Table", {
      props: {
        cells: serializeTableCells(createTableCells(rows, columns)),
        background: "#ffffff",
        borderColor: "#d1d5db",
        borderWidth: 1,
        cellBackground: "#ffffff",
        columnLabels: Array.from({ length: columns }, (_, index) => columnLabel(index)).join(","),
        columns,
        color: "#000000",
        fontSize: MOTION_DOC_FONT_SIZES.table,
        h: tableHeight(rows),
        rowLabels: Array.from({ length: rows }, (_, index) => String(index + 1)).join(","),
        rows,
        stripeBackground: "#f8fafc",
        w: tableWidth(columns)
      }
    });
  }

  return (
    <div className={`absolute bottom-[4.25rem] left-1/2 z-[60] ${panelWidth} -translate-x-1/2 rounded-xl border border-white/[0.08] bg-neutral-950/95 p-2.5 shadow-[0_18px_44px_rgba(0,0,0,0.68)] backdrop-blur-2xl sm:bottom-[5rem]`}>
      <div className="mb-2 flex items-center justify-between px-0.5">
        <span className="text-[11px] font-semibold text-neutral-200">{tx("Table size")}</span>
        <output
          aria-live="polite"
          className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-neutral-300"
        >
          {hoveredSize
            ? `${hoveredSize.columns} × ${hoveredSize.rows}`
            : `${tx("Up to")} ${tableGridSize} × ${tableGridSize}`}
        </output>
      </div>
      <div
        className="mx-auto grid w-fit justify-center gap-1"
        data-table-grid-size={tableGridSize}
        id="table-size-grid"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHoveredSize(null);
        }}
        onMouseLeave={() => setHoveredSize(null)}
        style={{ gridTemplateColumns: `repeat(${tableGridSize}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: tableGridSize }).map((_, rowIndex) =>
          Array.from({ length: tableGridSize }).map((__, columnIndex) => {
            const rows = rowIndex + 1;
            const columns = columnIndex + 1;
            const isActive = hoveredSize !== null && rows <= hoveredSize.rows && columns <= hoveredSize.columns;

            return (
              <button
                aria-label={locale === "zh-TW" ? `插入 ${columns} 欄 × ${rows} 列表格` : `Insert ${columns} by ${rows} table`}
                className={`${expanded ? "size-[18px]" : "size-6"} rounded-[3px] border transition-[border-color,background-color,box-shadow] ${
                  isActive
                    ? "border-pink-300/80 bg-pink-400/55 shadow-[0_0_8px_rgba(244,114,182,0.18)]"
                    : "border-white/[0.12] bg-white/[0.035] hover:border-pink-300/70 focus-visible:border-pink-300/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/35"
                }`}
                data-active={isActive ? "true" : undefined}
                key={`${rows}-${columns}`}
                onClick={() => addTable(rows, columns)}
                onFocus={() => setHoveredSize({ columns, rows })}
                onMouseEnter={() => setHoveredSize({ columns, rows })}
                type="button"
              />
            );
          })
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2 text-[10px]">
        <button
          aria-controls="table-size-grid"
          aria-expanded={expanded}
          className="rounded-md px-1 py-0.5 font-semibold text-pink-200 transition-colors hover:text-pink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/35"
          onClick={toggleExpandedGrid}
          type="button"
        >
          {expanded ? tx("Fewer sizes") : tx("More sizes")}
        </button>
        <span className="text-right text-neutral-500">{tx("Click a cell to insert")}</span>
      </div>
    </div>
  );
}

function tableWidth(columns: number) {
  return Math.min(82, Math.max(38, 20 + columns * 6));
}

function tableHeight(rows: number) {
  return Math.min(62, Math.max(24, 14 + rows * 5));
}
