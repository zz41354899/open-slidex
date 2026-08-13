
import { ColorActionBar } from "@/features/pitch/ui/inspector/color/ColorActionBar";
import { ColorPickerSurface } from "@/features/pitch/ui/inspector/color/ColorPickerSurface";

type CompactColorPanelProps = {
  closeAfterSelect?: boolean;
  label: string;
  onChange: (value: string) => void;
  onClose?: () => void;
  placeholder?: string;
  value: string;
};

export function CompactColorPanel({
  closeAfterSelect = false,
  label,
  onChange,
  onClose,
  placeholder = "inherit",
  value
}: CompactColorPanelProps) {
  function selectColor(nextValue: string) {
    onChange(nextValue);
    if (closeAfterSelect) onClose?.();
  }

  return (
    <>
      <ColorPickerSurface
        compact
        label={label}
        onChange={selectColor}
        value={value || placeholder}
      />
      <ColorActionBar
        label={label}
        onClear={() => selectColor("")}
        onPick={selectColor}
        onTransparent={() => selectColor("transparent")}
      />
    </>
  );
}
