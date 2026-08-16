
import { Grid3X3, Magnet, Maximize2 } from "lucide-react";
import { useId } from "react";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";
import { Field } from "@/features/pitch/ui/inspector/InspectorControls";
import { AccordionSection } from "@/features/pitch/ui/inspector/controls/AccordionSection";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { Switch } from "@/common/ui/shadcnPrimitives";

type SlideLayoutSectionProps = {
  isGridVisible: boolean;
  isSafeAreaVisible: boolean;
  isSnapEnabled: boolean;
  setIsGridVisible: (value: boolean) => void;
  setIsSafeAreaVisible: (value: boolean) => void;
  setIsSnapEnabled: (value: boolean) => void;
};

export function SlideLayoutSection({
  isGridVisible,
  isSafeAreaVisible,
  isSnapEnabled,
  setIsGridVisible,
  setIsSafeAreaVisible,
  setIsSnapEnabled
}: SlideLayoutSectionProps) {
  const { tx } = usePitchI18n();
  const gridSwitchId = useId();
  const safeAreaSwitchId = useId();

  return (
    <AccordionSection title="Canvas Grid & Layout" defaultOpen>
      <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2">
        <span className="text-[14px] text-neutral-500">{tx("Canvas size")}</span>
        <span className="font-mono text-[14px] text-neutral-300">16:9 · {MOTION_DOC_CANVAS_WIDTH}×{MOTION_DOC_CANVAS_HEIGHT}</span>
      </div>

      <Field label="Canvas grid">
        <div
          className={`flex items-center justify-between rounded-md border px-3 py-2 text-[14px] transition-colors cursor-pointer ${
            isGridVisible
              ? "border-neutral-600 bg-neutral-900 text-white"
              : "border-neutral-800 bg-transparent text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
          }`}
        >
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2" htmlFor={gridSwitchId}>
            <Grid3X3 size={13} />
            {tx("Grid Overlay")}
          </label>
          <Switch
            aria-label={tx("Grid Overlay")}
            checked={isGridVisible}
            id={gridSwitchId}
            onCheckedChange={setIsGridVisible}
          />
        </div>
      </Field>

      <Field label="Canvas guides">
        <div
          className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-[14px] transition-colors ${
            isSafeAreaVisible
              ? "border-[#8ea5ff]/55 bg-[#8ea5ff]/10 text-white"
              : "border-neutral-800 bg-transparent text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
          }`}
        >
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2" htmlFor={safeAreaSwitchId}>
            <Maximize2 size={13} />
            {tx("Safe area")}
          </label>
          <Switch
            aria-label={tx("Safe area")}
            checked={isSafeAreaVisible}
            id={safeAreaSwitchId}
            onCheckedChange={setIsSafeAreaVisible}
          />
        </div>
        <span className="text-[14px] leading-5 text-neutral-600">
          {tx("Keep important content inside this 5% inset.")} {tx("This guide does not restrict object placement.")}
        </span>
      </Field>

      <AlignmentSnapControl isSnapEnabled={isSnapEnabled} setIsSnapEnabled={setIsSnapEnabled} />

    </AccordionSection>
  );
}

export function AlignmentSnapControl({
  isSnapEnabled,
  setIsSnapEnabled
}: {
  isSnapEnabled: boolean;
  setIsSnapEnabled: (value: boolean) => void;
}) {
  const { tx } = usePitchI18n();
  const snapSwitchId = useId();

  return (
    <Field label="Alignment snapping">
      <div
        className={`flex items-center justify-between rounded-md border px-3 py-2 text-[14px] transition-colors cursor-pointer ${
          isSnapEnabled
            ? "border-[#8ea5ff]/55 bg-[#8ea5ff]/10 text-white"
            : "border-neutral-800 bg-transparent text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
        }`}
      >
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2" htmlFor={snapSwitchId}>
          <Magnet size={13} />
          {tx("Snap to guides")}
        </label>
        <Switch
          aria-label={tx("Snap to guides")}
          checked={isSnapEnabled}
          id={snapSwitchId}
          onCheckedChange={setIsSnapEnabled}
        />
      </div>
      <span className="text-[14px] leading-5 text-neutral-600">
        {tx("Objects lock onto slide edges, centers, and nearby objects.")}
      </span>
    </Field>
  );
}
