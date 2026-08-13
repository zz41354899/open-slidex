
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Minus, Rows3, Columns3, Grid3X3, X } from "lucide-react";
import { useState } from "react";
import {
  clearColOverride,
  clearCellOverride,
  clearRowOverride,
  parseCellOverrides,
  columnLabel,
  parseColOverrides,
  parseRowOverrides,
  resizeTableProps,
  tableCellsFromProps,
  tableSizeFromProps,
  updateColOverride,
  updateCellOverride,
  updateRowOverride,
  updateTableCell,
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
  type TableSelection
} from "@/core/motion-doc/application/tableBlock";
import { MOTION_DOC_FONT_SIZES } from "@/core/motion-doc/domain/typography";
import {
  Field,
  IconSegmentedControl,
  NativeSelect,
  NumberInput,
  type BlockFieldProps
} from "@/features/pitch/ui/inspector/InspectorControls";
import { clearTableEditorSelectionProps, tableEditorSelectionFromProps } from "@/features/pitch/application/tableEditorSelection";
import { colorSwatchStyle } from "@/features/pitch/ui/inspector/color/colorSwatchStyle";
import { CompactColorPanel } from "@/features/pitch/ui/inspector/color/CompactColorPanel";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/common/ui/shadcnPrimitives";

// ─── Main Component ──────────────────────────────────────────────────

export function TableFields({ block, selectedBlockIndex, updateBlock }: BlockFieldProps) {
  const { tx } = usePitchI18n();
  const [selectedCell, setSelectedCell] = useState<{ columnIndex: number; rowIndex: number } | null>(null);
  const size = tableSizeFromProps(block.props);
  const cells = tableCellsFromProps(block.props, size.rows, size.columns);
  const tableSelection = tableEditorSelectionFromProps(block.props);
  const selectionKind = tableSelection?.kind;
  const selectionIndex = tableSelection?.index ?? null;
  const hasSelection = tableSelection !== null;
  const hasScopedSelection = hasSelection || selectedCell !== null;

  // Resolve current colors based on selection
  const rowOverrides = parseRowOverrides(block.props);
  const colOverrides = parseColOverrides(block.props);
  const cellOverrides = parseCellOverrides(block.props);
  const cellOverride = selectedCell
    ? cellOverrides[`${selectedCell.rowIndex}:${selectedCell.columnIndex}`] ?? {}
    : null;
  const currentOverride = selectedCell
    ? {
        ...colOverrides[selectedCell.columnIndex],
        ...rowOverrides[selectedCell.rowIndex],
        ...cellOverride
      }
    : hasSelection
    ? selectionKind === "row" ? rowOverrides[selectionIndex!] ?? {} : colOverrides[selectionIndex!] ?? {}
    : null;

  const selectionLabel = selectedCell
    ? tx("Cell {cell}", { cell: `${columnLabel(selectedCell.columnIndex)}${selectedCell.rowIndex + 1}` })
    : hasSelection
    ? selectionKind === "row"
      ? tx("Row {index}", { index: selectionIndex! + 1 })
      : tx("Column {column}", { column: columnLabel(selectionIndex!) })
    : tx("Entire table");

  // Colors to display in the palette
  const bgColor = hasScopedSelection && currentOverride?.background
    ? currentOverride.background
    : String(block.props.background ?? block.props.backgroundColor ?? block.props.bg ?? "");
  const borderColor = hasScopedSelection && currentOverride?.borderColor
    ? currentOverride.borderColor
    : String(block.props.borderColor ?? "");
  const textColor = hasScopedSelection && currentOverride?.textColor
    ? currentOverride.textColor
    : String(block.props.color ?? block.props.textColor ?? "");

  function onBgChange(value: string) {
    if (selectedCell) {
      updateBlock(selectedBlockIndex, updateCellOverride(block.props, selectedCell.rowIndex, selectedCell.columnIndex, { background: value }));
    } else if (hasSelection && selectionIndex !== null) {
      const nextProps = selectionKind === "row"
        ? updateRowOverride(block.props, selectionIndex, { background: value })
        : updateColOverride(block.props, selectionIndex, { background: value });
      updateBlock(selectedBlockIndex, nextProps);
    } else {
      updateBlock(selectedBlockIndex, { ...block.props, background: value });
    }
  }

  function onBorderChange(value: string) {
    if (selectedCell) {
      updateBlock(selectedBlockIndex, updateCellOverride(block.props, selectedCell.rowIndex, selectedCell.columnIndex, { borderColor: value }));
    } else if (hasSelection && selectionIndex !== null) {
      const nextProps = selectionKind === "row"
        ? updateRowOverride(block.props, selectionIndex, { borderColor: value })
        : updateColOverride(block.props, selectionIndex, { borderColor: value });
      updateBlock(selectedBlockIndex, nextProps);
    } else {
      updateBlock(selectedBlockIndex, { ...block.props, borderColor: value });
    }
  }

  function onTextChange(value: string) {
    if (selectedCell) {
      updateBlock(selectedBlockIndex, updateCellOverride(block.props, selectedCell.rowIndex, selectedCell.columnIndex, { textColor: value }));
    } else if (hasSelection && selectionIndex !== null) {
      const nextProps = selectionKind === "row"
        ? updateRowOverride(block.props, selectionIndex, { textColor: value })
        : updateColOverride(block.props, selectionIndex, { textColor: value });
      updateBlock(selectedBlockIndex, nextProps);
    } else {
      updateBlock(selectedBlockIndex, { ...block.props, color: value });
    }
  }

  function clearOverride() {
    if (selectedCell) {
      updateBlock(selectedBlockIndex, clearCellOverride(block.props, selectedCell.rowIndex, selectedCell.columnIndex));
      return;
    }
    if (!hasSelection || selectionIndex === null) return;
    const nextProps = selectionKind === "row"
      ? clearRowOverride(block.props, selectionIndex)
      : clearColOverride(block.props, selectionIndex);
    updateBlock(selectedBlockIndex, nextProps);
  }

  function selectCell(rowIndex: number, columnIndex: number) {
    setSelectedCell({ columnIndex, rowIndex });
    if (tableSelection) {
      updateBlock(selectedBlockIndex, clearTableEditorSelectionProps(block.props));
    }
  }

  return (
    <div className="flex flex-col gap-5 animate-[bubble-appear_0.2s_ease-out]">

      {/* ── Size ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Rows">
          <NumberInput
            max={String(TABLE_MAX_ROWS)}
            min="1"
            onChange={(value) => {
              const nextRows = value === "" ? size.rows : value;
              updateBlock(selectedBlockIndex, resizeTableProps(block.props, nextRows, size.columns));
            }}
            step="1"
            value={size.rows}
          />
        </Field>
        <Field label="Columns">
          <NumberInput
            max={String(TABLE_MAX_COLUMNS)}
            min="1"
            onChange={(value) => {
              const nextColumns = value === "" ? size.columns : value;
              updateBlock(selectedBlockIndex, resizeTableProps(block.props, size.rows, nextColumns));
            }}
            step="1"
            value={size.columns}
          />
        </Field>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[12px] font-semibold text-neutral-200">{tx("Table style")}</div>
            <div className="mt-0.5 text-[10px] text-neutral-500">{tx("Grid, spacing and visual finish")}</div>
          </div>
          <span className="rounded-md bg-pink-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-pink-300">{tx("Visible")}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Grid line">
            <NativeSelect
              onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, borderStyle: value })}
              options={tableBorderStyleOptions}
              value={tableBorderStyleValue(block.props.borderStyle)}
            />
          </Field>
          <Field label="Line width">
            <NumberInput
              max="6"
              min="0"
              onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, borderWidth: value === "" ? 1 : value })}
              step="1"
              suffix="px"
              value={block.props.borderWidth ?? 1}
            />
          </Field>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="Cell padding X">
            <NumberInput max="40" min="0" onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, cellPaddingX: value === "" ? 10 : value })} step="1" suffix="px" value={block.props.cellPaddingX ?? 10} />
          </Field>
          <Field label="Cell padding Y">
            <NumberInput max="40" min="0" onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, cellPaddingY: value === "" ? 8 : value })} step="1" suffix="px" value={block.props.cellPaddingY ?? 8} />
          </Field>
        </div>
      </div>

      <TableCellMatrix
        cells={cells}
        columns={size.columns}
        onChange={(rowIndex, columnIndex, value) => {
          updateBlock(
            selectedBlockIndex,
            updateTableCell(block.props, rowIndex, columnIndex, value)
          );
        }}
        rows={size.rows}
        selection={tableSelection}
        selectedCell={selectedCell}
        onSelectCell={selectCell}
      />

      <IconSegmentedControl
        label="Text align"
        options={[
          { label: "Left", value: "left", icon: <AlignLeft size={14} /> },
          { label: "Center", value: "center", icon: <AlignCenter size={14} /> },
          { label: "Right", value: "right", icon: <AlignRight size={14} /> }
        ]}
        value={String(block.props.textAlign ?? "left")}
        onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, textAlign: value })}
      />

      <IconSegmentedControl
        label="Vertical align"
        options={[
          { label: "Top", value: "top", icon: <ArrowUp size={14} /> },
          { label: "Middle", value: "middle", icon: <Minus size={14} /> },
          { label: "Bottom", value: "bottom", icon: <ArrowDown size={14} /> }
        ]}
        value={String(block.props.textVerticalAlign ?? "middle")}
        onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, textVerticalAlign: value })}
      />

      {/* ── Color Palette ───────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Scope indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${hasScopedSelection ? "bg-violet-500/20 text-violet-300" : "bg-white/[0.06] text-neutral-400"}`}>
              {selectedCell
                ? <Grid3X3 size={12} />
                : hasSelection
                ? selectionKind === "row" ? <Rows3 size={12} /> : <Columns3 size={12} />
                : <Grid3X3 size={12} />
              }
            </span>
            <span className={`text-[12px] font-medium ${hasScopedSelection ? "text-violet-300" : "text-neutral-400"}`}>
              {selectionLabel}
            </span>
          </div>
          {hasScopedSelection ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={tx("Reset to table default")}
                  className="h-5 gap-1 rounded px-1.5 text-[10px] font-medium text-neutral-500 transition-colors hover:bg-white/[0.05] hover:text-red-300"
                  onClick={clearOverride}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  <X size={10} />
                  {tx("Reset")}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{tx("Reset to table default")}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        {/* Color swatches */}
        <div className="grid grid-cols-3 gap-2">
          <PaletteSwatch
            color={bgColor}
            label="Background"
            onChange={onBgChange}
            placeholder={hasScopedSelection ? "Inherit" : "#ffffff"}
          />
          <PaletteSwatch
            color={borderColor}
            label="Border"
            onChange={onBorderChange}
            placeholder={hasScopedSelection ? "Inherit" : "#d1d5db"}
          />
          <PaletteSwatch
            color={textColor}
            label="Text"
            onChange={onTextChange}
            placeholder={hasScopedSelection ? "Inherit" : "#000000"}
          />
        </div>
      </div>

      {/* ── Font size (compact) ─────────────────────────────────── */}
      <Field label="Font size">
        <NumberInput
          max="48"
          min="8"
          onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, fontSize: value === "" ? "" : value })}
          step="0.5"
          suffix="pt"
          value={block.props.fontSize ?? MOTION_DOC_FONT_SIZES.table}
        />
      </Field>

    </div>
  );
}

const tableBorderStyleOptions = [
  { label: "Solid", value: "solid" },
  { label: "Dashed", value: "dashed" },
  { label: "Dotted", value: "dotted" }
] as const;

function tableBorderStyleValue(value: string | number | undefined): "dashed" | "dotted" | "solid" {
  return value === "dashed" || value === "dotted" ? value : "solid";
}

function TableCellMatrix({
  cells,
  columns,
  onChange,
  rows,
  selection,
  selectedCell,
  onSelectCell
}: {
  cells: string[][];
  columns: number;
  onChange: (rowIndex: number, columnIndex: number, value: string) => void;
  rows: number;
  selection: TableSelection | null;
  selectedCell: { columnIndex: number; rowIndex: number } | null;
  onSelectCell: (rowIndex: number, columnIndex: number) => void;
}) {
  const gridTemplateColumns = `34px repeat(${columns}, minmax(72px, 1fr))`;

  return (
    <Field label="Cells">
      <div className="max-h-[220px] overflow-auto rounded-xl border border-white/[0.06] bg-white/[0.025] p-1.5 custom-scrollbar">
        <div className="grid gap-1" style={{ gridTemplateColumns }}>
          <div aria-hidden="true" className="h-7" />
          {Array.from({ length: columns }, (_, columnIndex) => {
            const selected = selection?.kind === "column" && selection.index === columnIndex;

            return (
              <div
                className={`flex h-7 items-center justify-center rounded-md text-[11px] font-semibold transition-colors ${
                  selected ? "bg-pink-500/70 text-white" : "bg-white/[0.04] text-neutral-500"
                }`}
                key={`table-field-column-${columnIndex}`}
              >
                {columnLabel(columnIndex)}
              </div>
            );
          })}

          {Array.from({ length: rows }, (_, rowIndex) => {
            const rowSelected = selection?.kind === "row" && selection.index === rowIndex;

            return (
              <TableCellMatrixRow
                cells={cells[rowIndex] ?? []}
                columns={columns}
                key={`table-field-row-${rowIndex}`}
                onChange={onChange}
                rowIndex={rowIndex}
                rowSelected={rowSelected}
                selectedColumnIndex={selection?.kind === "column" ? selection.index : null}
                selectedCell={selectedCell}
                onSelectCell={onSelectCell}
              />
            );
          })}
        </div>
      </div>
    </Field>
  );
}

function TableCellMatrixRow({
  cells,
  columns,
  onChange,
  rowIndex,
  rowSelected,
  selectedColumnIndex,
  selectedCell,
  onSelectCell
}: {
  cells: string[];
  columns: number;
  onChange: (rowIndex: number, columnIndex: number, value: string) => void;
  rowIndex: number;
  rowSelected: boolean;
  selectedColumnIndex: number | null;
  selectedCell: { columnIndex: number; rowIndex: number } | null;
  onSelectCell: (rowIndex: number, columnIndex: number) => void;
}) {
  const { tx } = usePitchI18n();
  return (
    <>
      <div
        className={`flex h-8 items-center justify-center rounded-md text-[11px] font-semibold transition-colors ${
          rowSelected ? "bg-pink-500/70 text-white" : "bg-white/[0.04] text-neutral-500"
        }`}
      >
        {rowIndex + 1}
      </div>
      {Array.from({ length: columns }, (_, columnIndex) => {
        const selected = rowSelected || selectedColumnIndex === columnIndex || (
          selectedCell?.rowIndex === rowIndex && selectedCell.columnIndex === columnIndex
        );

        return (
          <input
            aria-label={tx("Cell {cell}", { cell: `${columnLabel(columnIndex)}${rowIndex + 1}` })}
            className={`h-8 min-w-0 rounded-md border px-2 text-[12px] text-neutral-200 outline-none transition-colors placeholder:text-neutral-700 ${
              selected
                ? "border-pink-400/60 bg-pink-500/12 focus:border-pink-300/80"
                : "border-white/[0.05] bg-black/20 hover:bg-white/[0.04] focus:border-white/20 focus:bg-white/[0.06]"
            }`}
            key={`table-field-cell-${rowIndex}-${columnIndex}`}
            onFocus={() => onSelectCell(rowIndex, columnIndex)}
            onChange={(event) => onChange(rowIndex, columnIndex, event.currentTarget.value)}
            value={cells[columnIndex] ?? ""}
          />
        );
      })}
    </>
  );
}

// ─── Palette Swatch ──────────────────────────────────────────────────

function PaletteSwatch({
  color,
  label,
  onChange,
  placeholder
}: {
  color: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const { tx } = usePitchI18n();
  const [isOpen, setIsOpen] = useState(false);
  const resolvedColor = color || placeholder;
  const swatchBg = colorSwatchStyle(resolvedColor);

  return (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-neutral-500">{tx(label)}</span>
        <PopoverTrigger asChild>
          <button
            aria-expanded={isOpen}
            className="group relative flex h-10 w-full cursor-pointer items-end overflow-hidden rounded-lg border border-white/[0.08] transition-all hover:border-white/20 hover:shadow-[0_0_12px_rgba(139,92,246,0.1)]"
            type="button"
          >
            <span className="absolute inset-0" style={swatchBg} />
            <span className="relative z-10 w-full truncate bg-gradient-to-t from-black/60 to-transparent px-2 pb-1 pt-3 text-left font-mono text-[10px] text-white/70 group-hover:text-white/90">
              {color || tx("Default")}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-label={`${tx(label)} ${tx("color controls")}`}
          className="z-[1000] w-60 rounded-xl border-neutral-700 bg-[#111111] p-3 text-neutral-200 shadow-2xl shadow-black/60"
          sideOffset={8}
        >
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300">{tx(label)}</span>
            <button
              className="rounded border border-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white cursor-pointer"
              onClick={() => { onChange(""); setIsOpen(false); }}
              type="button"
            >
              {tx("Clear")}
            </button>
          </div>

          <CompactColorPanel label={label} onChange={onChange} placeholder={placeholder} value={color} />
        </PopoverContent>
      </div>
    </Popover>
  );
}
