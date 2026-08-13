import { useEffect, useState, type ClipboardEvent } from "react";
import {
  motionDocChartModel,
  motionDocChartMotions,
  motionDocChartBarGaps,
  motionDocChartColorModes,
  motionDocChartLabelModes,
  motionDocChartPaletteNames,
  motionDocChartPresetNames,
  motionDocChartPresetProps,
  parseMotionDocChartData,
  type MotionDocBlock,
  type MotionDocProps,
  type MotionDocChartDatum,
  type MotionDocChartBarGap,
  type MotionDocChartColorMode,
  type MotionDocChartLabelMode,
  type MotionDocChartMotion,
  type MotionDocChartPreset,
  type MotionDocChartType
} from "@open-slidex/sdk";
import {
  Button,
  Field,
  Input,
  Label,
  Select,
  ShadcnSlider,
  ShadcnSwitch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToggleGroup,
  ToggleGroupItem
} from "@open-slidex/editor-ui";
import { ChartColumnBig, ChartNoAxesColumn, Check, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { clearChartDatumColors, mergeChartProps, withoutDatumColor } from "./chartInspectorState";

const primaryChartTypes: MotionDocChartType[] = ["bar", "line", "area", "pie", "donut"];
const chartPalettes = {
  aurora: ["#7c3aed", "#2563eb", "#06b6d4", "#10b981"],
  editorial: ["#111827", "#475569", "#94a3b8", "#e2e8f0"],
  ocean: ["#2563eb", "#0ea5e9", "#14b8a6", "#84cc16"],
  sunset: ["#e11d48", "#f97316", "#f59e0b", "#a855f7"]
} satisfies Record<(typeof motionDocChartPaletteNames)[number], string[]>;

const chartDataInputClass = "h-[27px] w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0 font-mono text-[11px] text-[#d9dce2] shadow-none hover:bg-white/[0.035] focus-visible:border-[#8ea5ff]/25 focus-visible:bg-[#8ea5ff]/[0.055] focus-visible:ring-0 dark:bg-transparent dark:hover:bg-white/[0.035]";
const chartSelectionCardClass = "relative h-auto cursor-pointer rounded-[9px] border border-white/[0.055] bg-[#0d0f12] text-[#747983] shadow-none transition-[border-color,background-color,color,transform] hover:border-white/[0.13] hover:bg-[#15181c] hover:text-[#e2e4e8]";
const chartSelectionCardActiveClass = "border-[#8ea5ff]/30 bg-[#8ea5ff]/[0.08] text-[#c7d0ff]";
const chartSmallLabelClass = "text-[11px] font-semibold text-[#9aa0a9]";

const chartPaletteLabels = {
  aurora: "Aurora",
  editorial: "Editorial",
  ocean: "Ocean",
  sunset: "Sunset"
} satisfies Record<(typeof motionDocChartPaletteNames)[number], string>;

const motionCopy: Record<MotionDocChartMotion, { detail: string; label: string }> = {
  auto: { detail: "Best motion for this chart", label: "Automatic" },
  grow: { detail: "Build from the baseline", label: "Grow" },
  draw: { detail: "Trace the data path", label: "Draw" },
  sweep: { detail: "Reveal around the center", label: "Sweep" },
  pop: { detail: "Scale each mark in", label: "Pop" },
  none: { detail: "Show the final state", label: "None" }
};

type ChartInspectorProps = {
  block: MotionDocBlock;
  onPreviewMotion?: () => void;
  update: (props: MotionDocProps) => void;
};

type ChartInspectorTab = "data" | "motion" | "style";

export function ChartInspector({ block, onPreviewMotion, update }: ChartInspectorProps) {
  const { tx } = usePitchI18n();
  const type = chartType(block.props.type);
  const dataSource = String(block.props.data ?? "[]");
  const [tab, setTab] = useState<ChartInspectorTab>("data");
  const [rows, setRows] = useState(() => parseMotionDocChartData(dataSource));
  const model = motionDocChartModel(block.props);

  useEffect(() => {
    setRows(parseMotionDocChartData(dataSource));
  }, [dataSource]);

  const visibleTypes = type === "scatter" ? [...primaryChartTypes, "scatter" as const] : primaryChartTypes;

  function updateChart(patch: MotionDocProps) {
    update(mergeChartProps(block, patch));
  }

  function commitRows(nextRows: MotionDocChartDatum[]) {
    const normalized = nextRows.slice(0, 24).map((row, index) => ({
      ...(row.color ? { color: row.color } : {}),
      label: row.label.trim() || tx("Item {index}", { index: index + 1 }),
      ...(type === "scatter" && Number.isFinite(row.size) ? { size: row.size } : {}),
      value: finite(row.value, 0),
      ...(type === "scatter" && Number.isFinite(row.x) ? { x: row.x } : {})
    }));
    setRows(normalized);
    updateChart({ data: JSON.stringify(normalized) });
  }

  function applyPalette(palette: (typeof motionDocChartPaletteNames)[number]) {
    const nextRows = clearChartDatumColors(rows);
    setRows(nextRows);
    updateChart({ data: JSON.stringify(nextRows), palette });
  }

  function applyPreset(preset: MotionDocChartPreset) {
    const nextRows = clearChartDatumColors(rows);
    setRows(nextRows);
    updateChart({ ...motionDocChartPresetProps(preset, type), data: JSON.stringify(nextRows) });
  }

  function updateRow(index: number, patch: Partial<MotionDocChartDatum>, commit = false) {
    const next = rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row);
    setRows(next);
    if (commit) commitRows(next);
  }

  function pasteTable(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!/[\t,\n]/.test(pasted)) return;
    const parsed = parseTable(pasted, type);
    if (!parsed.length) return;
    event.preventDefault();
    commitRows(parsed);
  }

  return (
    <section aria-label={tx("Chart editor")} className="-mx-2">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-[3px]">
          <strong className="text-[13px] font-[690] tracking-[-0.01em] text-[#f2f3f5]">{tx("Chart design")}</strong>
          <span className="text-[11px] leading-[1.4] text-[#6f747d]">{tx("Editable SVG with built-in motion")}</span>
        </div>
        <span className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-md border border-[#8ea5ff]/20 bg-[#8ea5ff]/[0.06] px-1.5 py-1 text-[11px] font-semibold text-[#b8c3ff]">
          <i className="size-[5px] rounded-full bg-[#8ea5ff] shadow-[0_0_0_3px_rgba(142,165,255,0.1)]" data-chart-live-dot /> {tx("Animated")}
        </span>
      </div>

      <div aria-label={tx("Chart type")} className="mt-[13px] grid grid-cols-3 gap-1.5">
        {visibleTypes.map((candidate) => (
          <Button
            aria-pressed={type === candidate}
            className={`relative grid h-auto min-h-[60px] cursor-pointer place-items-center content-center gap-[3px] rounded-[10px] border border-white/[0.055] bg-[#0d0f12] p-0 text-[#747983] shadow-none transition-[border-color,background-color,color,transform] hover:-translate-y-px hover:border-white/[0.13] hover:bg-[#15181d] hover:text-[#d9dce2] ${type === candidate ? "border-[#8ea5ff]/35 bg-[#8ea5ff]/[0.09] text-[#c3cdff] shadow-[inset_0_1px_rgba(255,255,255,0.05)]" : ""}`}
            key={candidate}
            onClick={() => updateChart({ type: candidate })}
            type="button"
          >
            <ChartGlyph type={candidate} />
            <span className="text-[11px] font-semibold capitalize text-inherit">{tx(chartTypeLabel(candidate))}</span>
            {type === candidate ? <Check className="absolute right-1.5 top-1.5" size={11} /> : null}
          </Button>
        ))}
      </div>

      <Tabs className="gap-0" onValueChange={(value) => setTab(value as ChartInspectorTab)} value={tab}>
        <TabsList aria-label={tx("Chart settings")} className="mt-4 grid h-auto w-full grid-cols-3 gap-[3px] rounded-[10px] border border-white/[0.05] bg-[#0b0d0f] p-[3px] group-data-[orientation=horizontal]/tabs:h-auto">
          {(["data", "style", "motion"] as const).map((value) => (
            <TabsTrigger className="min-h-[29px] rounded-[7px] border-0 bg-transparent px-2 py-1 text-[12px] font-semibold capitalize text-[#656a73] shadow-none after:hidden hover:text-[#c5c8ce] focus-visible:ring-1 data-[state=active]:bg-[#1b1e23] data-[state=active]:text-[#f3f4f6] data-[state=active]:shadow-[inset_0_1px_rgba(255,255,255,0.06),0_3px_8px_rgba(0,0,0,0.2)] dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-[#1b1e23]" key={value} value={value}>
              {tx(value === "data" ? "Data" : value === "style" ? "Style" : "Motion")}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent className="flex-none pt-3.5" value="data">
          <div className="overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#0c0e11]">
            <div className={`${type === "scatter" ? "grid-cols-[minmax(48px,1.1fr)_38px_28px_38px_38px_25px] gap-[3px] px-1" : "grid-cols-[minmax(66px,1.35fr)_minmax(44px,0.72fr)_29px_27px] gap-1 px-1.5"} grid min-h-7 items-center border-b border-[var(--line)] bg-[#111419] font-mono text-[10px] text-[#666b74]`}>
              <span>{tx("Label")}</span><span>{type === "scatter" ? "Y" : tx("Value")}</span><span>{tx("Color")}</span>
              {type === "scatter" ? <><span>X</span><span>{tx("Size")}</span></> : null}
              <span aria-hidden="true" />
            </div>
            {rows.map((row, index) => (
              <div className={`${type === "scatter" ? "grid-cols-[minmax(48px,1.1fr)_38px_28px_38px_38px_25px] gap-[3px] px-1" : "grid-cols-[minmax(66px,1.35fr)_minmax(44px,0.72fr)_29px_27px] gap-1 px-1.5"} grid min-h-[38px] items-center border-b border-white/[0.04] last:border-b-0`} key={index}>
                <label className="min-w-0"><span className="sr-only">{tx("Row {index} label", { index: index + 1 })}</span><Input className={chartDataInputClass} onBlur={() => commitRows(rows)} onChange={(event) => updateRow(index, { label: event.currentTarget.value })} onPaste={pasteTable} value={row.label} /></label>
                <label className="min-w-0"><span className="sr-only">{tx("Row {index} value", { index: index + 1 })}</span><Input className={chartDataInputClass} inputMode="decimal" onBlur={() => commitRows(rows)} onChange={(event) => updateRow(index, { value: finite(event.currentTarget.value, 0) })} value={row.value} /></label>
                <label className="relative grid min-w-0 place-items-center"><span className="sr-only">{tx("Row {index} color", { index: index + 1 })}</span><Input aria-label={tx("Row {index} color", { index: index + 1 })} className="size-[22px] cursor-pointer rounded-[7px] border border-white/[0.12] bg-[#14171c] p-0.5 shadow-none focus-visible:ring-1 dark:bg-[#14171c]" onChange={(event) => { updateRow(index, { color: event.currentTarget.value }, true); }} type="color" value={row.color ?? model.palette[index % model.palette.length]} />{row.color ? <Button aria-label={tx("Use palette color")} className="absolute -bottom-1 -right-1 size-4 rounded bg-[#20242b] p-0 text-[#aebdff] hover:bg-[#2a3039]" onClick={() => { const next = rows.map((item, rowIndex) => rowIndex === index ? withoutDatumColor(item) : item); commitRows(next); }} size="icon-xs" variant="ghost"><RotateCcw size={9} /></Button> : null}</label>
                {type === "scatter" ? (
                  <>
                    <label className="min-w-0"><span className="sr-only">{tx("Row {index} X", { index: index + 1 })}</span><Input className={chartDataInputClass} inputMode="decimal" onBlur={() => commitRows(rows)} onChange={(event) => updateRow(index, { x: finite(event.currentTarget.value, index + 1) })} value={row.x ?? index + 1} /></label>
                    <label className="min-w-0"><span className="sr-only">{tx("Row {index} size", { index: index + 1 })}</span><Input className={chartDataInputClass} inputMode="decimal" onBlur={() => commitRows(rows)} onChange={(event) => updateRow(index, { size: finite(event.currentTarget.value, 12) })} value={row.size ?? 12} /></label>
                  </>
                ) : null}
                <Button aria-label={tx("Remove row {index}", { index: index + 1 })} className="size-[25px] cursor-pointer rounded-md bg-transparent p-0 text-[#555a63] shadow-none hover:bg-red-300/[0.08] hover:text-[#e69a94] disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-25" disabled={rows.length === 1} onClick={() => commitRows(rows.filter((_, rowIndex) => rowIndex !== index))} size="icon-xs" variant="ghost"><Trash2 size={12} /></Button>
              </div>
            ))}
          </div>
          <Button className="mt-2 h-[30px] min-h-[30px] cursor-pointer rounded-lg border border-white/[0.07] bg-[#101318] px-[9px] py-0 text-[11px] font-semibold text-[#989da7] shadow-none hover:border-white/[0.14] hover:bg-[#101318] hover:text-white" disabled={rows.length >= 24} onClick={() => commitRows([...rows, { label: "", value: 0 }])} variant="outline">
            <Plus size={13} /> {tx("Add row")}
          </Button>
          <p className="mx-px mb-0 mt-2 text-[11px] leading-[1.55] text-[#626771]">{tx("Paste CSV or spreadsheet cells into any label field. Up to 24 rows.")}</p>
        </TabsContent>

        <TabsContent className="flex-none pt-3.5" value="style">
          <ChartControlLabel detail={tx("A polished starting point you can customize")} label={tx("Design preset")} />
          <div className="mb-4 mt-2.5 grid grid-cols-3 gap-1.5">
            {motionDocChartPresetNames.map((preset) => <Button aria-pressed={model.chartPreset === preset} className={`${chartSelectionCardClass} grid min-h-[58px] place-items-center content-center gap-[5px] p-0 ${model.chartPreset === preset ? chartSelectionCardActiveClass : ""}`} key={preset} onClick={() => applyPreset(preset)}><PresetGlyph preset={preset} /><span className="text-[11px] font-semibold text-inherit">{tx(presetLabel(preset))}</span>{model.chartPreset === preset ? <Check className="absolute right-1.5 top-1.5 size-2.5" size={11} /> : null}</Button>)}
          </div>
          <ChartControlLabel detail={tx("Applies to every data mark")} label={tx("Palette")} />
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {motionDocChartPaletteNames.map((palette) => {
              const selected = String(block.props.palette ?? "aurora") === palette;
              return (
                <Button aria-pressed={selected} className={`${chartSelectionCardClass} grid min-h-[54px] grid-cols-[1fr_auto] content-center items-center gap-[5px] px-[9px] py-2 text-left ${selected ? "border-[#8ea5ff]/30 bg-[#15181c] text-[#e2e4e8]" : ""}`} key={palette} onClick={() => applyPalette(palette)}>
                  <span className="col-span-full flex gap-[3px]">{chartPalettes[palette].map((color) => <i className="h-[7px] w-[18px] rounded-sm" key={color} style={{ background: color }} />)}</span>
                  <span className="text-[11px] font-semibold text-inherit">{tx(chartPaletteLabels[palette])}</span>
                  {selected ? <Check className="col-start-2 row-start-2 text-[#aebdff]" size={11} /> : null}
                </Button>
              );
            })}
          </div>
          <ChartSegmentedControl
            label={tx("Color treatment")}
            options={motionDocChartColorModes.map((value) => ({
              label: tx(colorModeLabel(value)),
              value
            }))}
            onChange={(value) => updateChart({ colorMode: value })}
            value={chartColorMode(block.props.colorMode)}
          />
          {chartColorMode(block.props.colorMode) === "emphasis" ? (
            <Field className="mt-3 gap-1.5 [&>[data-slot=native-select-wrapper]]:w-full">
              <Label className={chartSmallLabelClass}>{tx("Key data point")}</Label>
              <Select className="w-full border-white/[0.055] bg-[#0d0f12] text-[12px] text-[#d9dce2] dark:bg-[#0d0f12]" onChange={(event) => updateChart({ emphasisIndex: event.currentTarget.value })} value={String(chartEmphasisIndex(block.props.emphasisIndex, rows.length))}>
                {rows.map((row, index) => <option key={index} value={index}>{row.label || tx("Item {index}", { index: index + 1 })}</option>)}
              </Select>
            </Field>
          ) : null}
          <div className="mt-3.5 grid grid-cols-2 gap-1.5">
            <ChartToggle active={String(block.props.showAxes ?? "true") !== "false"} description={tx("Grid and scale")} label={tx("Axes")} onChange={(active) => updateChart({ showAxes: String(active) })} />
            <ChartToggle active={String(block.props.showGrid ?? "true") !== "false"} description={tx("Quiet background guides")} label={tx("Grid") } onChange={(active) => updateChart({ showGrid: String(active) })} />
          </div>
          <ChartSegmentedControl
            label={tx("Data labels")}
            options={motionDocChartLabelModes.map((value) => ({ label: tx(labelModeLabel(value)), value }))}
            onChange={(value) => updateChart({ labelMode: value, showLabels: String(value !== "none") })}
            value={chartLabelMode(block.props.labelMode, block.props.showLabels)}
          />
          {type === "bar" ? (
            <>
              <ChartSegmentedControl label={tx("Column width")} options={motionDocChartBarGaps.map((value) => ({ label: tx(barGapLabel(value)), value }))} onChange={(value) => updateChart({ barGap: value })} value={chartBarGap(block.props.barGap)} />
              <ChartSegmentedControl label={tx("Column corners")} options={[{ label: tx("Square"), value: "0" }, { label: tx("Soft"), value: "10" }, { label: tx("Pill"), value: "999" }]} onChange={(value) => updateChart({ barRadius: value })} value={barRadiusChoice(block.props.barRadius)} />
            </>
          ) : null}
          {type === "line" || type === "area" ? (
            <div className="mt-3.5 grid grid-cols-1 gap-1.5">
              <ChartToggle active={String(block.props.lineSmooth ?? "true") !== "false"} description={tx("Curved data path")} label={tx("Smooth line")} onChange={(active) => updateChart({ lineSmooth: String(active) })} />
            </div>
          ) : null}
          {type === "area" ? <ChartRangeControl label={tx("Area fill")} max={70} min={20} onChange={(value) => updateChart({ areaOpacity: value })} suffix="%" value={chartNumber(block.props.areaOpacity, 32)} /> : null}
          {type === "donut" ? <ChartRangeControl label={tx("Donut hole")} max={78} min={42} onChange={(value) => updateChart({ donutHole: value })} suffix="%" value={chartNumber(block.props.donutHole, 64)} /> : null}
          <Field className="mt-3.5 gap-1.5">
            <Label className={chartSmallLabelClass}>{tx("Accessible description")}</Label>
            <Input className="border-white/[0.055] bg-[#0d0f12] text-[12px] text-[#d9dce2] dark:bg-[#0d0f12]" defaultValue={String(block.props.ariaLabel ?? "")} onBlur={(event) => updateChart({ ariaLabel: event.currentTarget.value.trim() })} placeholder={tx("Quarterly revenue by region")} />
          </Field>
        </TabsContent>

        <TabsContent className="flex-none pt-3.5" value="motion">
          <ChartControlLabel detail={tx("Plays when the slide becomes active")} label={tx("Build animation")} />
          <div className="mt-2.5 grid gap-[5px]">
            {motionDocChartMotions.map((motion) => {
              const selected = String(block.props.chartMotion ?? "auto") === motion;
              return (
                <Button aria-pressed={selected} className={`grid h-auto min-h-[49px] cursor-pointer grid-cols-[38px_minmax(0,1fr)_16px] items-center gap-[9px] rounded-[9px] border border-white/[0.05] bg-[#0d0f12] px-[9px] py-[5px] text-left text-[#777c85] shadow-none hover:border-white/[0.12] hover:bg-[#15181c] ${selected ? "border-[#8ea5ff]/30 bg-[#8ea5ff]/[0.07] text-[#b9c5ff]" : ""}`} key={motion} onClick={() => {
                  updateChart({ chartMotion: motion });
                  window.setTimeout(() => onPreviewMotion?.(), 0);
                }} variant="ghost">
                  <MotionGlyph motion={motion} selected={selected} />
                  <span className="grid gap-[3px]"><strong className="text-[12px] text-[#d7d9de]">{tx(motionCopy[motion].label)}</strong><small className="text-[10px] text-[#656a73]">{tx(motionCopy[motion].detail)}</small></span>
                  {selected ? <Check size={12} /> : null}
                </Button>
              );
            })}
          </div>
          <p className="mx-px mb-0 mt-2 text-[11px] leading-[1.55] text-[#626771]">{tx("Animation is disabled automatically when the viewer requests reduced motion. PPTX exports the matching editable final state.")}</p>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function ChartControlLabel({ detail, label }: { detail: string; label: string }) {
  return (
    <div className="grid gap-[3px]">
      <strong className="text-[12px] font-[690] tracking-[-0.01em] text-[#f2f3f5]">{label}</strong>
      <span className="text-[10px] leading-[1.4] text-[#6f747d]">{detail}</span>
    </div>
  );
}

function ChartToggle({ active, description, label, onChange }: { active: boolean; description: string; label: string; onChange: (active: boolean) => void }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-2 rounded-[9px] border border-white/[0.055] bg-[#0d0f12] px-[9px] py-2 text-left text-[#8d929b]">
      <span className="grid gap-0.5"><strong className="text-[12px] text-[#d7d9de]">{label}</strong><small className="text-[10px] text-[#626771]">{description}</small></span>
      <ShadcnSwitch aria-label={label} checked={active} onCheckedChange={onChange} size="sm" />
    </div>
  );
}

function ChartSegmentedControl<T extends string>({ label, onChange, options, value }: {
  label: string;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  return (
    <div className="mt-3.5 grid gap-[7px]">
      <span className={chartSmallLabelClass}>{label}</span>
      <ToggleGroup className="grid w-full grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-1 rounded-[9px] border border-white/[0.055] bg-[#0b0d0f] p-[3px]" onValueChange={(next) => { if (next) onChange(next as T); }} spacing={1} type="single" value={value}>
        {options.map((option) => <ToggleGroupItem aria-label={option.label} className="h-auto min-h-[29px] min-w-0 rounded-md border-0 bg-transparent px-[5px] text-[11px] font-semibold text-[#717681] shadow-none hover:bg-transparent hover:text-[#d4d7dd] data-[state=on]:bg-[#8ea5ff]/[0.14] data-[state=on]:text-[#c7d0ff] data-[state=on]:shadow-[inset_0_1px_rgba(255,255,255,0.06)]" key={option.value} value={option.value}>{option.label}</ToggleGroupItem>)}
      </ToggleGroup>
    </div>
  );
}

function ChartRangeControl({ label, max, min, onChange, suffix, value }: {
  label: string;
  max: number;
  min: number;
  onChange: (value: string) => void;
  suffix: string;
  value: number;
}) {
  return (
    <div className="mt-3.5 grid gap-[7px]">
      <span className="flex items-center justify-between text-[11px] text-[#9aa0a9]"><strong className="font-semibold">{label}</strong><b className="font-mono text-[11px] text-[#c4cbff]">{value}{suffix}</b></span>
      <ShadcnSlider aria-label={label} className="w-full" max={max} min={min} onValueChange={([nextValue]) => onChange(String(nextValue))} value={[value]} />
    </div>
  );
}

function ChartGlyph({ type }: { type: MotionDocChartType }) {
  if (type === "pie" || type === "donut") return <svg aria-hidden="true" className="h-6 w-8" viewBox="0 0 32 24"><circle cx="16" cy="12" fill="none" r="8" stroke="currentColor" strokeWidth={type === "donut" ? 4 : 8} strokeDasharray="34 16" transform="rotate(-90 16 12)" /></svg>;
  if (type === "bar") return <svg aria-hidden="true" className="h-6 w-8" viewBox="0 0 32 24"><path d="M5 20V12h5v8M14 20V5h5v15M23 20V9h5v11" fill="currentColor" opacity=".86" /></svg>;
  if (type === "scatter") return <svg aria-hidden="true" className="h-6 w-8" viewBox="0 0 32 24"><circle cx="8" cy="16" r="2.5" fill="currentColor" /><circle cx="16" cy="9" r="3.5" fill="currentColor" opacity=".72" /><circle cx="25" cy="14" r="2" fill="currentColor" opacity=".5" /></svg>;
  return <svg aria-hidden="true" className="h-6 w-8" viewBox="0 0 32 24"><path d="M4 18 11 11l6 3 10-9" fill={type === "area" ? "currentColor" : "none"} fillOpacity=".16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /><path d="M4 20h24" stroke="currentColor" strokeOpacity=".2" /></svg>;
}

function MotionGlyph({ motion, selected }: { motion: MotionDocChartMotion; selected: boolean }) {
  return (
    <span aria-hidden="true" className="flex h-7 w-[34px] items-end gap-[3px] rounded-md bg-white/[0.035] p-[5px]" data-chart-motion-glyph data-motion={motion} data-selected={selected || undefined}>
      <i className="h-2 w-1.5 origin-bottom rounded-t-sm rounded-b-[1px] bg-current opacity-50" />
      <i className="h-3.5 w-1.5 origin-bottom rounded-t-sm rounded-b-[1px] bg-current opacity-75" />
      <i className="h-[18px] w-1.5 origin-bottom rounded-t-sm rounded-b-[1px] bg-current" />
    </span>
  );
}

function PresetGlyph({ preset }: { preset: MotionDocChartPreset }) {
  const Icon = preset === "minimal" ? ChartNoAxesColumn : preset === "vivid" ? Sparkles : ChartColumnBig;
  return <Icon aria-hidden="true" size={18} strokeWidth={1.8} />;
}

function parseTable(value: string, type: MotionDocChartType): MotionDocChartDatum[] {
  return value.trim().split(/\r?\n/).slice(0, 24).flatMap((line) => {
    const cells = line.split(line.includes("\t") ? "\t" : ",").map((cell) => cell.trim());
    if (!cells.length) return [];
    const numeric = cells.slice(1).map((cell) => Number(cell));
    if (!Number.isFinite(numeric[0])) return [];
    return [{
      label: cells[0] || "",
      ...(type === "scatter" && Number.isFinite(numeric[1]) ? { size: Number.isFinite(numeric[2]) ? numeric[2] : 12, x: numeric[0], value: numeric[1] } : { value: numeric[0] })
    }];
  });
}

function chartType(value: unknown): MotionDocChartType {
  return ["bar", "line", "area", "pie", "donut", "scatter"].includes(String(value))
    ? value as MotionDocChartType
    : "bar";
}

function chartTypeLabel(type: MotionDocChartType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function chartColorMode(value: unknown): MotionDocChartColorMode {
  return motionDocChartColorModes.includes(value as MotionDocChartColorMode)
    ? value as MotionDocChartColorMode
    : "palette";
}

function chartLabelMode(value: unknown, showLabels: unknown): MotionDocChartLabelMode {
  if (motionDocChartLabelModes.includes(value as MotionDocChartLabelMode)) return value as MotionDocChartLabelMode;
  return String(showLabels ?? "true") === "false" ? "none" : "all";
}

function chartBarGap(value: unknown): MotionDocChartBarGap {
  return motionDocChartBarGaps.includes(value as MotionDocChartBarGap)
    ? value as MotionDocChartBarGap
    : "balanced";
}

function chartEmphasisIndex(value: unknown, count: number) {
  return Math.min(Math.max(Math.floor(finite(value, Math.max(count - 1, 0))), 0), Math.max(count - 1, 0));
}

function chartNumber(value: unknown, fallback: number) {
  return Math.round(finite(value, fallback));
}

function barRadiusChoice(value: unknown) {
  const radius = finite(value, 10);
  if (radius <= 0) return "0";
  return radius >= 999 ? "999" : "10";
}

function colorModeLabel(value: MotionDocChartColorMode) {
  return value === "single" ? "Single" : value === "emphasis" ? "Focus" : value === "gradient" ? "Gradient" : "Palette";
}

function labelModeLabel(value: MotionDocChartLabelMode) {
  return value === "value" ? "Values" : value === "category" ? "Names" : value === "none" ? "No labels" : "All";
}

function presetLabel(value: MotionDocChartPreset) {
  return value === "minimal" ? "Minimal" : value === "vivid" ? "Vivid" : "Executive";
}

function barGapLabel(value: MotionDocChartBarGap) {
  return value === "compact" ? "Thick" : value === "airy" ? "Slim" : "Standard";
}

function finite(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
