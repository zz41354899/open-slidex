"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import type { MotionDocBlock, MotionDocProps, MotionDocTableBlock } from "@/core/motion-doc/domain/motionDocTypes";
import {
  MOTION_DOC_FONT_SIZES,
  motionDocFontPointsToCanvasPixels
} from "@/core/motion-doc/domain/typography";
import {
  clearTableSelection,
  deleteTableColumn,
  deleteTableRow,
  insertTableColumn,
  insertTableRow,
  parseColOverrides,
  parseRowOverrides,
  pasteTableClipboard,
  tableCellsFromProps,
  tableClipboardFromSelection,
  tableColumnLabelsFromProps,
  tableColumnTrackValuesFromProps,
  tableRowLabelsFromProps,
  tableRowTrackValuesFromProps,
  tableSizeFromProps,
  tableTrackTemplate,
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
  updateColOverride,
  updateRowOverride,
  updateTableCell,
  type CellStyleOverride,
  type TableClipboard,
  type TableSelection
} from "@/core/motion-doc/application/tableBlock";
import { clearTableEditorSelectionProps } from "@/features/pitch/application/tableEditorSelection";
import type { BlockUpdater } from "@/features/pitch/application/pitchCommandTypes";
import { TableContextMenu } from "@/features/pitch/ui/preview/TableContextMenu";
import { TableSelectionStyleBar } from "@/features/pitch/ui/preview/TableSelectionStyleBar";
import { TableSelectionResizeOverlay } from "@/features/pitch/ui/preview/TableSelectionResizeOverlay";
import { TableTrackResizeGuides } from "@/features/pitch/ui/preview/TableTrackResizeGuides";
import { useTableTrackResize } from "@/features/pitch/ui/preview/interaction/useTableTrackResize";

type ContextMenuState = {
  position: { x: number; y: number };
  selection: TableSelection;
  target: TableMenuTarget;
};

type TableMenuTarget = {
  columnIndex?: number;
  rowIndex?: number;
};

type TableFrameEditorProps = {
  block: MotionDocTableBlock;
  blockIndex: number;
  onSelectionChange?: (selection: TableSelection | null) => void;
  onSelectBlock: (index: number) => void;
  onUpdateBlock: BlockUpdater;
};

export function isTableBlock(block: MotionDocBlock): block is MotionDocTableBlock {
  return block.type === "Table" && "props" in block;
}

export function TableFrameEditor({
  block,
  blockIndex,
  onSelectionChange,
  onSelectBlock,
  onUpdateBlock
}: TableFrameEditorProps) {
  const [selection, setSelection] = useState<TableSelection | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [clipboard, setClipboard] = useState<TableClipboard | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const latestPropsRef = useRef(block.props);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const { columns, rows } = tableSizeFromProps(block.props);
  const cells = tableCellsFromProps(block.props, rows, columns);
  const columnLabels = tableColumnLabelsFromProps(block.props, columns);
  const rowLabels = tableRowLabelsFromProps(block.props, rows);
  const columnTracks = tableColumnTrackValuesFromProps(block.props, columns);
  const rowTracks = tableRowTrackValuesFromProps(block.props, rows);
  const headerHeight = Math.max(22, numberFromProp(block.props.headerHeight, 26));
  const rowHeaderWidth = Math.max(28, numberFromProp(block.props.rowHeaderWidth, 34));
  const borderWidth = numberFromProp(block.props.borderWidth, 1);
  const borderStyle = tableBorderStyle(block.props.borderStyle);
  const colors = tableColors(block.props);
  const textAlign = tableTextAlign(block.props.textAlign);
  const verticalAlign = tableVerticalAlign(block.props.textVerticalAlign);
  const tableGridStyle: CSSProperties = {
    gridTemplateColumns: tableTrackTemplate(columnTracks),
    gridTemplateRows: tableTrackTemplate(rowTracks)
  };
  const columnHeaderStyle: CSSProperties = {
    gridTemplateColumns: tableTrackTemplate(columnTracks),
    height: headerHeight,
    left: 0,
    right: 0,
    top: -(headerHeight + 8)
  };
  const rowHeaderStyle: CSSProperties = {
    bottom: 0,
    gridTemplateRows: tableTrackTemplate(rowTracks),
    left: -(rowHeaderWidth + 10),
    top: 0,
    width: rowHeaderWidth
  };
  const baseCellStyle = tableCellStyle({
    borderColor: colors.border,
    borderStyle,
    borderWidth,
    paddingX: numberFromProp(block.props.cellPaddingX, 10),
    paddingY: numberFromProp(block.props.cellPaddingY, 8),
    fontSize: motionDocFontPointsToCanvasPixels(
      numberFromProp(block.props.fontSize, MOTION_DOC_FONT_SIZES.table)
    ),
    textAlign,
    verticalAlign
  });

  useLayoutEffect(() => {
    latestPropsRef.current = cleanTableEditorProps(block.props);
  }, [block.props]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  function closeContextMenu() {
    setContextMenu(null);
  }

  useEffect(() => {
    setSelection((current) => {
      if (!current) return current;
      if (current.kind === "row" && current.index >= rows) {
        onSelectionChangeRef.current?.(null);
        return null;
      }
      if (current.kind === "column" && current.index >= columns) {
        onSelectionChangeRef.current?.(null);
        return null;
      }
      return current;
    });
  }, [columns, rows]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    function closeMenu(event: globalThis.PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }

      setContextMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    }

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("resize", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("resize", closeContextMenu);
      window.removeEventListener("scroll", closeContextMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  const selectTablePart = useCallback(function selectTablePart(nextSelection: TableSelection) {
    setSelection(nextSelection);
    onSelectionChangeRef.current?.(nextSelection);
    onSelectBlock(blockIndex);
    frameRef.current?.focus({ preventScroll: true });
  }, [blockIndex, onSelectBlock]);

  function openContextMenu(
    event: MouseEvent<HTMLElement>,
    nextSelection: TableSelection,
    target: TableMenuTarget = tableMenuTargetFromSelection(nextSelection)
  ) {
    event.preventDefault();
    event.stopPropagation();
    selectTablePart(nextSelection);
    setContextMenu({
      position: clampedTableMenuPosition(event, canvasBoundaryRect(frameRef.current)),
      selection: nextSelection,
      target
    });
  }

  function openCellContextMenu(event: MouseEvent<HTMLElement>, rowIndex: number, columnIndex: number) {
    const nextSelection = selection?.kind === "column" && selection.index === columnIndex
      ? { index: columnIndex, kind: "column" as const }
      : { index: rowIndex, kind: "row" as const };

    openContextMenu(event, nextSelection, { columnIndex, rowIndex });
  }

  function stopFramePointer(event: PointerEvent<HTMLElement>) {
    event.stopPropagation();
  }

  const updateTableProps = useCallback(function updateTableProps(nextProps: MotionDocProps, transient = false) {
    const cleanProps = cleanTableEditorProps(nextProps);
    latestPropsRef.current = cleanProps;
    onUpdateBlock(blockIndex, cleanProps, undefined, transient ? { transient: true } : undefined);
  }, [blockIndex, onUpdateBlock]);

  const startTableTrackResize = useTableTrackResize({
    columnTracks,
    frameRef,
    latestPropsRef,
    rowTracks,
    selectTablePart,
    updateTableProps
  });

  function updateCell(rowIndex: number, columnIndex: number, value: string, transient = true) {
    updateTableProps(updateTableCell(latestPropsRef.current, rowIndex, columnIndex, value), transient);
  }

  function updateSelectionStyle(currentSelection: TableSelection, patch: CellStyleOverride) {
    const baseProps = latestPropsRef.current;
    const nextProps = currentSelection.kind === "row"
      ? updateRowOverride(baseProps, currentSelection.index, patch)
      : updateColOverride(baseProps, currentSelection.index, patch);

    updateTableProps(nextProps);
  }

  const copySelection = useCallback(function copySelection(currentSelection: TableSelection) {
    const nextClipboard = tableClipboardFromSelection(latestPropsRef.current, currentSelection);
    setClipboard(nextClipboard);

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(nextClipboard.cells.join(currentSelection.kind === "row" ? "\t" : "\n"));
    }
  }, []);

  const clearSelectionContents = useCallback(function clearSelectionContents(currentSelection: TableSelection) {
    updateTableProps(clearTableSelection(latestPropsRef.current, currentSelection));
  }, [updateTableProps]);

  const cutSelectionContents = useCallback(function cutSelectionContents(currentSelection: TableSelection) {
    copySelection(currentSelection);
    clearSelectionContents(currentSelection);
  }, [clearSelectionContents, copySelection]);

  const deleteRowAt = useCallback(function deleteRowAt(rowIndex: number) {
    updateTableProps(deleteTableRow(latestPropsRef.current, rowIndex));
    setSelection(null);
  }, [updateTableProps]);

  const deleteColumnAt = useCallback(function deleteColumnAt(columnIndex: number) {
    updateTableProps(deleteTableColumn(latestPropsRef.current, columnIndex));
    setSelection(null);
  }, [updateTableProps]);

  const insertRowAt = useCallback(function insertRowAt(rowIndex: number) {
    updateTableProps(insertTableRow(latestPropsRef.current, rowIndex));
  }, [updateTableProps]);

  const insertColumnAt = useCallback(function insertColumnAt(columnIndex: number) {
    updateTableProps(insertTableColumn(latestPropsRef.current, columnIndex));
  }, [updateTableProps]);

  const pasteSelectionContents = useCallback(function pasteSelectionContents(currentSelection: TableSelection) {
    if (!clipboard) return;
    updateTableProps(pasteTableClipboard(latestPropsRef.current, currentSelection, clipboard));
  }, [clipboard, updateTableProps]);

  function runMenuAction(action: () => void) {
    action();
    setContextMenu(null);
  }

  const rowOverrides = parseRowOverrides(block.props);
  const colOverrides = parseColOverrides(block.props);

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-20 overflow-visible rounded-[inherit]"
        ref={frameRef}
        style={{ color: colors.text }}
        tabIndex={-1}
      >
        <div
          className="absolute grid overflow-hidden rounded-md border shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
          style={{
            ...columnHeaderStyle,
            background: editorControlColors.background,
            borderColor: editorControlColors.border
          }}
        >
          {columnLabels.map((label, columnIndex) => {
            const isSelected = selection?.kind === "column" && selection.index === columnIndex;

            return (
              <button
                aria-label={`Select column ${columnIndex + 1}`}
                className="pointer-events-auto min-w-0 truncate px-1 text-center text-[12px] font-semibold outline-none transition-colors"
                data-table-context-target
                key={`table-column-hit-${columnIndex}`}
                onClick={(event) => {
                  event.stopPropagation();
                  selectTablePart({ index: columnIndex, kind: "column" });
                }}
                onContextMenu={(event) => openContextMenu(event, { index: columnIndex, kind: "column" })}
                onPointerDown={stopFramePointer}
                style={{
                  background: isSelected ? editorControlColors.selectedBackground : "transparent",
                  borderRight: columnIndex === columns - 1 ? 0 : `1px solid ${editorControlColors.border}`,
                  color: isSelected ? editorControlColors.selectedText : editorControlColors.text
                }}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>

        <div
          className="absolute grid overflow-hidden rounded-md border shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
          style={{
            ...rowHeaderStyle,
            background: editorControlColors.background,
            borderColor: editorControlColors.border
          }}
        >
          {rowLabels.map((label, rowIndex) => {
            const isSelected = selection?.kind === "row" && selection.index === rowIndex;

            return (
              <button
                aria-label={`Select row ${rowIndex + 1}`}
                className="pointer-events-auto min-w-0 truncate px-1 text-center text-[12px] font-semibold outline-none transition-colors"
                data-table-context-target
                key={`table-row-hit-${rowIndex}`}
                onClick={(event) => {
                  event.stopPropagation();
                  selectTablePart({ index: rowIndex, kind: "row" });
                }}
                onContextMenu={(event) => openContextMenu(event, { index: rowIndex, kind: "row" })}
                onPointerDown={stopFramePointer}
                style={{
                  background: isSelected ? editorControlColors.selectedBackground : "transparent",
                  borderBottom: rowIndex === rows - 1 ? 0 : `1px solid ${editorControlColors.border}`,
                  color: isSelected ? editorControlColors.selectedText : editorControlColors.text
                }}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>

        <div
          className="absolute inset-0 grid overflow-hidden rounded-[inherit]"
          style={{
            ...tableGridStyle,
            background: colors.background,
            border: `${borderWidth}px ${borderStyle} ${colors.border}`,
            boxSizing: "border-box"
          }}
        >
          {cells.flatMap((row, rowIndex) =>
            row.map((cell, columnIndex) => {
              const rowSelected = selection?.kind === "row" && selection.index === rowIndex;
              const columnSelected = selection?.kind === "column" && selection.index === columnIndex;
              const selected = rowSelected || columnSelected;

              return (
                <EditableTableCell
                  baseStyle={baseCellStyle}
                  colOverride={colOverrides[columnIndex]}
                  colors={colors}
                  columnIndex={columnIndex}
                  key={`table-cell-editor-${rowIndex}-${columnIndex}`}
                  onContextMenu={(event) => openCellContextMenu(event, rowIndex, columnIndex)}
                  onPointerDown={stopFramePointer}
                  onSelect={() => {
                    onSelectBlock(blockIndex);
                    setSelection(null);
                    onSelectionChangeRef.current?.(null);
                  }}
                  onUpdate={(value, transient) => updateCell(rowIndex, columnIndex, value, transient)}
                  rowIndex={rowIndex}
                  rowOverride={rowOverrides[rowIndex]}
                  selected={selected}
                  value={cell}
                />
              );
            })
          )}
        </div>


        {selection ? (
          <TableSelectionResizeOverlay
            columnTracks={columnTracks}
            onResizeStart={startTableTrackResize}
            rowTracks={rowTracks}
            selection={selection}
          />
        ) : null}

        <TableTrackResizeGuides
          columnTracks={columnTracks}
          onResizeStart={startTableTrackResize}
          rowTracks={rowTracks}
        />

        {/* ── Floating style bar for selected row/column ── */}
        {selection ? (
          <TableSelectionStyleBar
            block={block}
            columnTracks={columnTracks}
            headerHeight={headerHeight}
            onUpdateStyle={updateSelectionStyle}
            rowHeaderWidth={rowHeaderWidth}
            rowTracks={rowTracks}
            selection={selection}
          />
        ) : null}
      </div>

      {contextMenu ? (
        <TableContextMenu
          clipboard={clipboard}
          canAddColumn={columns < TABLE_MAX_COLUMNS}
          canAddRow={rows < TABLE_MAX_ROWS}
          canUseColumnActions={contextMenu.target.columnIndex !== undefined}
          canUseRowActions={contextMenu.target.rowIndex !== undefined}
          menuRef={menuRef}
          onClear={() => runMenuAction(() => clearSelectionContents(contextMenu.selection))}
          onCopy={() => runMenuAction(() => copySelection(contextMenu.selection))}
          onCut={() => runMenuAction(() => cutSelectionContents(contextMenu.selection))}
          onDeleteColumn={() => runMenuAction(() => deleteColumnAt(contextMenu.target.columnIndex ?? contextMenu.selection.index))}
          onDeleteRow={() => runMenuAction(() => deleteRowAt(contextMenu.target.rowIndex ?? contextMenu.selection.index))}
          onInsertColumn={() => runMenuAction(() => insertColumnAt(contextMenu.target.columnIndex ?? contextMenu.selection.index))}
          onInsertRow={() => runMenuAction(() => insertRowAt(contextMenu.target.rowIndex ?? contextMenu.selection.index))}
          onPaste={() => {
            if (!clipboard) return;
            runMenuAction(() => pasteSelectionContents(contextMenu.selection));
          }}
          position={contextMenu.position}
          selection={contextMenu.selection}
        />
      ) : null}
    </>
  );
}

function EditableTableCell({
  baseStyle,
  colOverride,
  colors,
  columnIndex,
  onContextMenu,
  onPointerDown,
  onSelect,
  onUpdate,
  rowIndex,
  rowOverride,
  selected,
  value
}: {
  baseStyle: CSSProperties;
  colOverride?: CellStyleOverride;
  colors: ReturnType<typeof tableColors>;
  columnIndex: number;
  onContextMenu: (event: MouseEvent<HTMLTextAreaElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLTextAreaElement>) => void;
  onSelect: () => void;
  onUpdate: (value: string, transient: boolean) => void;
  rowIndex: number;
  rowOverride?: CellStyleOverride;
  selected: boolean;
  value: string;
}) {
  const overrideBg = rowOverride?.background || colOverride?.background;
  const overrideText = rowOverride?.textColor || colOverride?.textColor;
  const overrideBorder = rowOverride?.borderColor || colOverride?.borderColor;
  const overrideFontSize = rowOverride?.fontSize ?? colOverride?.fontSize;

  const background = overrideBg || (selected ? colors.selectionSoft : rowIndex % 2 === 1 ? colors.stripeBackground : colors.cellBackground);
  const color = overrideText || colors.text;

  const borderStyle = overrideBorder
    ? { borderBottomColor: overrideBorder, borderRightColor: overrideBorder }
    : {};

  return (
    <div
      className="min-h-0 min-w-0 overflow-hidden"
      style={{
        ...baseStyle,
        ...borderStyle,
        background,
        color,
        ...(overrideFontSize === undefined
          ? {}
          : { fontSize: motionDocFontPointsToCanvasPixels(overrideFontSize) })
      }}
    >
      <textarea
        aria-label={`Edit cell ${rowIndex + 1}, ${columnIndex + 1}`}
        className="pointer-events-auto w-full resize-none overflow-hidden bg-transparent p-0 outline-none"
        data-table-context-target
        onChange={(event) => onUpdate(event.currentTarget.value, true)}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={onContextMenu}
        onFocus={() => onSelect()}
        onKeyDown={(event) => event.stopPropagation()}
        onPointerDown={onPointerDown}
        onBlur={(event) => {
          const nextValue = event.currentTarget.value;

          if (nextValue !== value) {
            onUpdate(nextValue, false);
          }
        }}
        rows={1}
        spellCheck={false}
        style={{
          color: "inherit",
          fieldSizing: "content",
          fontFamily: "inherit",
          fontSize: "inherit",
          lineHeight: "inherit",
          maxHeight: "100%",
          minHeight: "1.25em",
          textAlign: baseStyle.textAlign
        }}
        value={value}
      />
    </div>
  );
}

function tableCellStyle({
  borderColor,
  borderStyle,
  borderWidth,
  fontSize,
  paddingX,
  paddingY,
  textAlign,
  verticalAlign
}: {
  borderColor: string;
  borderStyle: "dashed" | "dotted" | "solid";
  borderWidth: number;
  fontSize: number;
  paddingX: number;
  paddingY: number;
  textAlign: "center" | "left" | "right";
  verticalAlign: "center" | "flex-end" | "flex-start";
}): CSSProperties {
  return {
    alignItems: verticalAlign,
    borderBottomColor: borderColor,
    borderBottomStyle: borderStyle,
    borderBottomWidth: `${borderWidth}px`,
    borderRightColor: borderColor,
    borderRightStyle: borderStyle,
    borderRightWidth: `${borderWidth}px`,
    boxSizing: "border-box",
    display: "flex",
    fontSize,
    justifyContent: justifyValue(textAlign),
    lineHeight: 1.25,
    minHeight: 0,
    minWidth: 0,
    padding: `${paddingY}px ${paddingX}px`,
    textAlign
  };
}

function tableBorderStyle(value: string | number | undefined): "dashed" | "dotted" | "solid" {
  return value === "dashed" || value === "dotted" ? value : "solid";
}

const editorControlColors = {
  background: "rgba(255,255,255,0.96)",
  border: "rgba(148,163,184,0.28)",
  selectedBackground: "rgba(236,72,153,0.90)",
  selectedText: "#ffffff",
  text: "#374151"
} satisfies Record<string, string>;

function tableColors(props: MotionDocProps) {
  return {
    background: colorValue(props.background ?? props.backgroundColor ?? props.bg, "#ffffff"),
    border: colorValue(props.borderColor, "#d1d5db"),
    cellBackground: colorValue(props.cellBackground, "#ffffff"),
    selection: "rgba(236,72,153,0.62)",
    selectionSoft: "rgba(236,72,153,0.18)",
    stripeBackground: colorValue(props.stripeBackground, "#f8fafc"),
    text: colorValue(props.color ?? props.textColor, "#000000")
  };
}

function colorValue(value: string | number | undefined, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberFromProp(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? Math.max(parsed, 0) : fallback;
}

function cleanTableEditorProps(props: MotionDocProps) {
  return clearTableEditorSelectionProps(props);
}

function tableMenuTargetFromSelection(selection: TableSelection): TableMenuTarget {
  return selection.kind === "row"
    ? { rowIndex: selection.index }
    : { columnIndex: selection.index };
}

function tableTextAlign(value: string | number | undefined) {
  if (value === "center" || value === "right") {
    return value;
  }

  return "left";
}

function tableVerticalAlign(value: string | number | undefined) {
  if (value === "bottom") {
    return "flex-end";
  }

  if (value === "middle" || value === "center") {
    return "center";
  }

  return "flex-start";
}

function justifyValue(value: "center" | "left" | "right") {
  if (value === "center") return "center";
  if (value === "right") return "flex-end";
  return "flex-start";
}

function canvasBoundaryRect(frame: HTMLElement | null) {
  return frame?.closest("[data-canvas-surface]")?.getBoundingClientRect()
    ?? frame?.closest("[aria-label^='16:9 canvas']")?.getBoundingClientRect()
    ?? document.querySelector("[data-canvas-surface]")?.getBoundingClientRect()
    ?? null;
}

function clampedTableMenuPosition(event: MouseEvent<HTMLElement>, boundaryRect?: DOMRect | null) {
  const menuWidth = 240;
  const menuHeight = 276;
  const margin = 12;
  const rect = boundaryRect ?? {
    bottom: window.innerHeight,
    left: 0,
    right: window.innerWidth,
    top: 0
  };
  const minX = rect.left + margin;
  const minY = rect.top + margin;
  const maxX = Math.max(minX, rect.right - menuWidth - margin);
  const maxY = Math.max(minY, rect.bottom - menuHeight - margin);

  return {
    x: Math.max(minX, Math.min(event.clientX, maxX)),
    y: Math.max(minY, Math.min(event.clientY, maxY))
  };
}
