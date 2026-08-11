"use client";

import {
  Clipboard,
  Copy,
  CopyPlus,
  Group,
  Image,
  Lock,
  SendToBack,
  BringToFront,
  Trash2,
  Ungroup,
  Unlock
} from "lucide-react";
import type { ComponentType, MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { MotionDocBlock } from "@/core/motion-doc/domain/motionDocTypes";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type CanvasContextMenuProps = {
  canPaste: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGroup: () => void;
  onMoveToBack: () => void;
  onMoveToFront: () => void;
  onPaste: () => void;
  onToggleLock: () => void;
  onUngroup: () => void;
  onUseAsBackground: () => void;
  position: { x: number; y: number };
  selectedBlock: MotionDocBlock | undefined;
  selectedBlocksLocked: boolean;
};

type MenuIcon = ComponentType<{ className?: string; size?: number }>;

export function CanvasContextMenu({
  canPaste,
  canGroup,
  canUngroup,
  onClose,
  onCopy,
  onDelete,
  onDuplicate,
  onGroup,
  onMoveToBack,
  onMoveToFront,
  onPaste,
  onToggleLock,
  onUngroup,
  onUseAsBackground,
  position,
  selectedBlock,
  selectedBlocksLocked
}: CanvasContextMenuProps) {
  const { tx } = usePitchI18n();
  const hasSelection = Boolean(selectedBlock);
  const canUseAsBackground = selectedBlock?.type === "ImageBlock" && typeof selectedBlock.props.src === "string" && selectedBlock.props.src.trim().length > 0;

  function run(action: () => void, disabled = false) {
    if (disabled) {
      return;
    }

    action();
    onClose();
  }

  const menu = (
    <>
      <style>{`
        @keyframes slidexCanvasContextMenuIn {
          from {
            opacity: 0;
            transform: translate3d(0, -4px, 0) scale(0.965);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          [data-canvas-context-menu] {
            animation: none !important;
          }
        }
      `}</style>
      <div
        aria-label={tx("Canvas actions")}
        className="fixed z-[100] w-56 select-none overflow-hidden rounded-xl border border-white/[0.08] bg-[#111114]/95 py-1.5 text-[13px] text-neutral-200 shadow-[0_22px_70px_rgba(0,0,0,0.56),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
        data-canvas-context-menu
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        role="menu"
        style={{
          animation: "slidexCanvasContextMenuIn 130ms cubic-bezier(0.16, 1, 0.3, 1)",
          left: position.x,
          top: position.y,
          transformOrigin: "16px 12px"
        }}
      >
        {canUngroup ? (
          <MenuItem icon={Ungroup} label={tx("Ungroup")} onClick={() => run(onUngroup)} shortcut="⇧ Cmd G" />
        ) : (
          <MenuItem disabled={!canGroup} icon={Group} label={tx("Group")} onClick={() => run(onGroup, !canGroup)} shortcut="Cmd G" />
        )}
        <MenuSeparator />
        {canUseAsBackground ? (
          <>
            <MenuItem icon={Image} label={tx("Use as background")} onClick={() => run(onUseAsBackground)} />
            <MenuSeparator />
          </>
        ) : null}
        <MenuItem disabled={!hasSelection} icon={Copy} label={tx("Copy")} onClick={() => run(onCopy, !hasSelection)} shortcut="Cmd C" />
        <MenuItem disabled={!canPaste} icon={Clipboard} label={tx("Paste")} onClick={() => run(onPaste, !canPaste)} shortcut="Cmd V" />
        <MenuItem disabled={!hasSelection} icon={CopyPlus} label={tx("Duplicate")} onClick={() => run(onDuplicate, !hasSelection)} shortcut="Cmd D" />
        <MenuItem danger disabled={!hasSelection} icon={Trash2} label={tx("Delete")} onClick={() => run(onDelete, !hasSelection)} shortcut="Del" />
        <MenuSeparator />
        <MenuItem disabled={!hasSelection} icon={BringToFront} label={tx("Bring to front")} onClick={() => run(onMoveToFront, !hasSelection)} />
        <MenuItem disabled={!hasSelection} icon={SendToBack} label={tx("Send to back")} onClick={() => run(onMoveToBack, !hasSelection)} />
        <MenuSeparator />
        <MenuItem
          disabled={!hasSelection}
          icon={selectedBlocksLocked ? Unlock : Lock}
          label={tx(selectedBlocksLocked ? "Unlock position" : "Lock position")}
          onClick={() => run(onToggleLock, !hasSelection)}
        />
      </div>
    </>
  );
  return typeof document === "undefined" ? null : createPortal(menu, document.body);
}

function MenuItem({
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
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
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
      onClick={onClick}
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

function MenuSeparator() {
  return <div className="my-1 h-px bg-white/[0.07]" role="separator" />;
}
