
import { Paintbrush, Palette, SquareSlash, Type as TypeIcon } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  parseColOverrides,
  parseRowOverrides,
  type CellStyleOverride,
  type TableSelection
} from "@/core/motion-doc/application/tableBlock";
import type { MotionDocTableBlock } from "@/core/motion-doc/domain/motionDocTypes";
import { selectedTableTrackGeometry } from "@/features/pitch/application/tableTrackGeometry";
import { CompactColorPanel } from "@/features/pitch/ui/inspector/color/CompactColorPanel";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type TableSelectionStyleBarProps = {
  block: MotionDocTableBlock;
  columnTracks: number[];
  headerHeight: number;
  onUpdateStyle: (selection: TableSelection, patch: CellStyleOverride) => void;
  rowHeaderWidth: number;
  rowTracks: number[];
  selection: TableSelection;
};

export function TableSelectionStyleBar({
  block,
  columnTracks,
  headerHeight,
  onUpdateStyle,
  rowHeaderWidth,
  rowTracks,
  selection
}: TableSelectionStyleBarProps) {
  const { tx } = usePitchI18n();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const isRow = selection.kind === "row";
  const index = selection.index;
  const rowOverrides = parseRowOverrides(block.props);
  const colOverrides = parseColOverrides(block.props);
  const currentOverride = isRow ? rowOverrides[index] : colOverrides[index];
  const style: CSSProperties = {
    alignItems: "center",
    backdropFilter: "blur(12px)",
    background: "rgba(24, 24, 27, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)",
    display: "flex",
    gap: 4,
    padding: 6,
    pointerEvents: "auto",
    position: "absolute",
    transform: "translate(-50%, -50%)",
    zIndex: 30
  };

  const geometry = selectedTableTrackGeometry(isRow ? rowTracks : columnTracks, index);
  if (isRow) {
    style.left = `calc(-${rowHeaderWidth + 38}px)`;
    style.top = `${geometry.offset + geometry.size / 2}%`;
  } else {
    style.left = `${geometry.offset + geometry.size / 2}%`;
    style.top = `calc(-${headerHeight + 38}px)`;
  }

  return (
    <>
      <div
        className="animate-[bubble-appear_0.15s_ease-out]"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        style={style}
      >
        <button
          aria-label={tx("Style Palette")}
          className={`flex h-7 w-7 items-center justify-center rounded transition-colors outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${isOpen ? "bg-white/20 text-white" : "text-neutral-400 hover:bg-white/10 hover:text-white"}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
            setIsOpen((value) => !value);
          }}
          ref={buttonRef}
          title={tx("Style Palette")}
          type="button"
        >
          <Palette size={14} />
        </button>
      </div>

      {isOpen ? (
        <CombinedStylePicker
          anchorRef={buttonRef}
          bgColor={currentOverride?.background || ""}
          borderColor={currentOverride?.borderColor || ""}
          isRow={isRow}
          onChangeBg={(value) => onUpdateStyle(selection, { background: value })}
          onChangeBorder={(value) => onUpdateStyle(selection, { borderColor: value })}
          onChangeText={(value) => onUpdateStyle(selection, { textColor: value })}
          onClose={() => setIsOpen(false)}
          textColor={currentOverride?.textColor || ""}
        />
      ) : null}
    </>
  );
}

type ColorTab = "bg" | "border" | "text";

function useAnchoredPopover({
  anchorRef,
  isRow,
  onClose,
  panelRef,
  width = 240
}: {
  anchorRef: RefObject<HTMLElement | null>;
  isRow: boolean;
  onClose: () => void;
  panelRef: RefObject<HTMLElement | null>;
  width?: number;
}) {
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    function updatePosition() {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 12;
      const nextStyle: CSSProperties = { position: "fixed", width, zIndex: 10000 };

      if (isRow) {
        nextStyle.top = Math.max(margin, rect.top);
        if (rect.left < width + margin) nextStyle.left = rect.right + 8;
        else nextStyle.right = window.innerWidth - rect.left + 8;
      } else {
        const maxLeft = Math.max(window.innerWidth - width - margin, margin);
        nextStyle.left = Math.min(Math.max(rect.left - width / 2 + rect.width / 2, margin), maxLeft);
        if (rect.top < 260) nextStyle.top = rect.bottom + 8;
        else nextStyle.bottom = window.innerHeight - rect.top + 8;
      }
      setStyle(nextStyle);
    }

    function handlePointerDown(event: globalThis.PointerEvent) {
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !panelRef.current?.contains(target)) onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, isRow, onClose, panelRef, width]);

  return style;
}

function ColorPanel({ onChange, onClose, value }: { value: string; onChange: (value: string) => void; onClose: () => void }) {
  const { tx } = usePitchI18n();
  return <CompactColorPanel closeAfterSelect label={tx("Selection color")} onChange={onChange} onClose={onClose} value={value} />;
}

function CombinedStylePicker({
  anchorRef,
  bgColor,
  borderColor,
  isRow,
  onChangeBg,
  onChangeBorder,
  onChangeText,
  onClose,
  textColor
}: {
  anchorRef: RefObject<HTMLElement | null>;
  bgColor: string;
  borderColor: string;
  isRow: boolean;
  onChangeBg: (value: string) => void;
  onChangeBorder: (value: string) => void;
  onChangeText: (value: string) => void;
  onClose: () => void;
  textColor: string;
}) {
  const { tx } = usePitchI18n();
  const [activeTab, setActiveTab] = useState<ColorTab>("bg");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const style = useAnchoredPopover({ anchorRef, isRow, onClose, panelRef });
  const value = activeTab === "bg" ? bgColor : activeTab === "border" ? borderColor : textColor;
  const onChange = activeTab === "bg" ? onChangeBg : activeTab === "border" ? onChangeBorder : onChangeText;

  return createPortal(
    <div
      className="w-56 rounded-xl border border-neutral-700 bg-[#111111] p-3 shadow-2xl shadow-black/60 animate-[bubble-appear_0.15s_ease-out]"
      data-table-style-popover
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => stopFloatingPointer(event)}
      onPointerUp={(event) => stopFloatingPointer(event)}
      ref={panelRef}
      style={style}
    >
      <div className="mb-3 flex rounded-md bg-white/[0.05] p-0.5">
        {(["bg", "border", "text"] as const).map((tab) => (
          <button
            className={`flex flex-1 items-center justify-center rounded-sm py-1.5 transition-colors ${activeTab === tab ? "bg-white/10 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"}`}
            key={tab}
            onPointerDown={(event) => {
              stopFloatingPointer(event, true);
              setActiveTab(tab);
            }}
            title={tx(tab === "bg" ? "Background" : tab === "border" ? "Border" : "Text")}
            type="button"
          >
            {tab === "bg" ? <Paintbrush size={14} /> : tab === "border" ? <SquareSlash size={14} /> : <TypeIcon size={14} />}
          </button>
        ))}
      </div>
      <div className="pt-2">
        <ColorPanel onChange={onChange} onClose={onClose} value={value} />
      </div>
    </div>,
    document.body
  );
}

function stopFloatingPointer(event: PointerEvent<HTMLElement>, preventDefault = false) {
  event.stopPropagation();
  if (preventDefault) event.preventDefault();
}
