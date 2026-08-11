"use client";

import { Clipboard, Columns3, Copy, Eraser, Rows3, Scissors, Trash2 } from "lucide-react";
import type { ComponentType, RefObject } from "react";
import { createPortal } from "react-dom";
import {
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
  type TableClipboard,
  type TableSelection
} from "@/core/motion-doc/application/tableBlock";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type MenuIcon = ComponentType<{ className?: string; size?: number }>;

export function TableContextMenu({
  clipboard,
  canAddColumn,
  canAddRow,
  canUseColumnActions,
  canUseRowActions,
  menuRef,
  onClear,
  onCopy,
  onCut,
  onDeleteColumn,
  onDeleteRow,
  onInsertColumn,
  onInsertRow,
  onPaste,
  position,
  selection
}: {
  clipboard: TableClipboard | null;
  canAddColumn: boolean;
  canAddRow: boolean;
  canUseColumnActions?: boolean;
  canUseRowActions?: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  onClear: () => void;
  onCopy: () => void;
  onCut: () => void;
  onDeleteColumn: () => void;
  onDeleteRow: () => void;
  onInsertColumn: () => void;
  onInsertRow: () => void;
  onPaste: () => void;
  position: { x: number; y: number };
  selection: TableSelection;
}) {
  const { tx, txMaximumItems } = usePitchI18n();
  const isRow = selection.kind === "row";
  const showRowActions = canUseRowActions ?? isRow;
  const showColumnActions = canUseColumnActions ?? !isRow;

  return createPortal(
    <div
      aria-label={tx("Table actions")}
      className="fixed z-[110] w-60 select-none overflow-hidden rounded-xl border border-white/[0.08] bg-[#111114]/95 py-1.5 text-[13px] text-neutral-200 shadow-[0_22px_70px_rgba(0,0,0,0.56),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
      data-table-context-menu
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      ref={menuRef}
      role="menu"
      style={{ left: position.x, top: position.y }}
    >
      <TableMenuItem icon={Scissors} label={tx("Cut")} onClick={onCut} shortcut="Cmd X" />
      <TableMenuItem icon={Copy} label={tx("Copy")} onClick={onCopy} shortcut="Cmd C" />
      <TableMenuItem disabled={!clipboard} icon={Clipboard} label={tx("Paste")} onClick={onPaste} shortcut="Cmd V" />
      <TableMenuItem icon={Eraser} label={tx("Clear")} onClick={onClear} />
      <div className="my-1 h-px bg-white/[0.07]" role="separator" />
      {showRowActions ? <TableMenuItem disabled={!canAddRow} icon={Rows3} label={canAddRow ? tx("Add row") : txMaximumItems(TABLE_MAX_ROWS, "Rows")} onClick={onInsertRow} /> : null}
      {showColumnActions ? <TableMenuItem disabled={!canAddColumn} icon={Columns3} label={canAddColumn ? tx("Add column") : txMaximumItems(TABLE_MAX_COLUMNS, "Columns")} onClick={onInsertColumn} /> : null}
      <div className="my-1 h-px bg-white/[0.07]" role="separator" />
      {showRowActions ? <TableMenuItem danger icon={Trash2} label={tx("Delete row")} onClick={onDeleteRow} /> : null}
      {showColumnActions ? <TableMenuItem danger icon={Trash2} label={tx("Delete column")} onClick={onDeleteColumn} /> : null}
    </div>,
    document.body
  );
}

function TableMenuItem({
  danger = false,
  disabled = false,
  icon: Icon,
  label,
  onClick,
  shortcut
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: MenuIcon;
  label: string;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <button
      className={`group flex h-9 w-full items-center gap-3 px-3 text-left transition-all duration-150 ${
        disabled
          ? "cursor-not-allowed text-neutral-600"
          : danger
            ? "text-red-300 hover:bg-red-500/12 hover:text-red-200"
            : "text-neutral-200 hover:bg-white/[0.075] hover:text-white"
      }`}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) onClick();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      role="menuitem"
      type="button"
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${disabled ? "text-neutral-700" : danger ? "text-red-300/90 group-hover:bg-red-400/10" : "text-neutral-400 group-hover:bg-white/[0.06] group-hover:text-neutral-100"}`}>
        <Icon className="shrink-0" size={15} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut ? (
        <span className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] leading-none ${disabled ? "border-white/[0.03] bg-white/[0.02] text-neutral-700" : "border-white/[0.06] bg-white/[0.055] text-neutral-400"}`}>
          {shortcut}
        </span>
      ) : null}
    </button>
  );
}
