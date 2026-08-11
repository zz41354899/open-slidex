import { useEffect, useState, type ClipboardEvent } from "react";
import {
  motionDocChartMotions,
  motionDocChartPaletteNames,
  parseMotionDocChartData,
  type MotionDocBlock,
  type MotionDocProps,
  type MotionDocChartDatum,
  type MotionDocChartMotion,
  type MotionDocChartType
} from "@open-slidex/sdk";
import { Check, MoreHorizontal, Plus, Trash2 } from "lucide-react";

const primaryChartTypes: MotionDocChartType[] = ["bar", "line", "area", "pie", "donut"];
const chartPalettes = {
  aurora: ["#7c3aed", "#2563eb", "#06b6d4", "#10b981"],
  editorial: ["#111827", "#475569", "#94a3b8", "#e2e8f0"],
  ocean: ["#2563eb", "#0ea5e9", "#14b8a6", "#84cc16"],
  sunset: ["#e11d48", "#f97316", "#f59e0b", "#a855f7"]
} satisfies Record<(typeof motionDocChartPaletteNames)[number], string[]>;

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

export function ChartInspector({ block, onPreviewMotion, update }: ChartInspectorProps) {
  const type = chartType(block.props.type);
  const dataSource = String(block.props.data ?? "[]");
  const [tab, setTab] = useState<"data" | "motion" | "style">("data");
  const [showMoreTypes, setShowMoreTypes] = useState(type === "scatter");
  const [rows, setRows] = useState(() => parseMotionDocChartData(dataSource));

  useEffect(() => {
    setRows(parseMotionDocChartData(dataSource));
  }, [dataSource]);

  const visibleTypes = showMoreTypes || type === "scatter"
    ? [...primaryChartTypes, "scatter" as const]
    : primaryChartTypes;

  function updateChart(patch: MotionDocProps) {
    update(mergeChartProps(block, patch));
  }

  function commitRows(nextRows: MotionDocChartDatum[]) {
    const normalized = nextRows.slice(0, 24).map((row, index) => ({
      ...(row.color ? { color: row.color } : {}),
      label: row.label.trim() || `Item ${index + 1}`,
      ...(type === "scatter" && Number.isFinite(row.size) ? { size: row.size } : {}),
      value: finite(row.value, 0),
      ...(type === "scatter" && Number.isFinite(row.x) ? { x: row.x } : {})
    }));
    setRows(normalized);
    updateChart({ data: JSON.stringify(normalized) });
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
    <section className="chart-inspector" aria-label="Chart editor">
      <div className="chart-section-heading">
        <div><strong>Chart design</strong><span>Editable SVG with built-in motion</span></div>
        <span className="chart-live-badge"><i /> Animated</span>
      </div>

      <div className="chart-type-grid" aria-label="Chart type">
        {visibleTypes.map((candidate) => (
          <button
            aria-pressed={type === candidate}
            className={type === candidate ? "is-selected" : ""}
            key={candidate}
            onClick={() => updateChart({ type: candidate })}
            type="button"
          >
            <ChartGlyph type={candidate} />
            <span>{chartTypeLabel(candidate)}</span>
            {type === candidate ? <Check className="chart-type-check" size={11} /> : null}
          </button>
        ))}
        {!showMoreTypes && type !== "scatter" ? (
          <button className="chart-more-type" onClick={() => setShowMoreTypes(true)} type="button">
            <MoreHorizontal size={17} /><span>More</span>
          </button>
        ) : null}
      </div>

      <div className="chart-tabs" role="tablist" aria-label="Chart settings">
        {(["data", "style", "motion"] as const).map((value) => (
          <button className={tab === value ? "is-selected" : ""} key={value} onClick={() => setTab(value)} role="tab" type="button">
            {value}
          </button>
        ))}
      </div>

      {tab === "data" ? (
        <div className="chart-tab-panel">
          <div className={`chart-data-table ${type === "scatter" ? "is-scatter" : ""}`}>
            <div className="chart-data-header">
              <span>Label</span><span>{type === "scatter" ? "Y" : "Value"}</span>
              {type === "scatter" ? <><span>X</span><span>Size</span></> : null}
              <span aria-hidden="true" />
            </div>
            {rows.map((row, index) => (
              <div className="chart-data-row" key={index}>
                <label><span className="sr-only">Row {index + 1} label</span><input onBlur={() => commitRows(rows)} onChange={(event) => updateRow(index, { label: event.currentTarget.value })} onPaste={pasteTable} value={row.label} /></label>
                <label><span className="sr-only">Row {index + 1} value</span><input inputMode="decimal" onBlur={() => commitRows(rows)} onChange={(event) => updateRow(index, { value: finite(event.currentTarget.value, 0) })} value={row.value} /></label>
                {type === "scatter" ? (
                  <>
                    <label><span className="sr-only">Row {index + 1} X</span><input inputMode="decimal" onBlur={() => commitRows(rows)} onChange={(event) => updateRow(index, { x: finite(event.currentTarget.value, index + 1) })} value={row.x ?? index + 1} /></label>
                    <label><span className="sr-only">Row {index + 1} size</span><input inputMode="decimal" onBlur={() => commitRows(rows)} onChange={(event) => updateRow(index, { size: finite(event.currentTarget.value, 12) })} value={row.size ?? 12} /></label>
                  </>
                ) : null}
                <button aria-label={`Remove row ${index + 1}`} disabled={rows.length === 1} onClick={() => commitRows(rows.filter((_, rowIndex) => rowIndex !== index))} type="button"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
          <button className="chart-add-row" disabled={rows.length >= 24} onClick={() => commitRows([...rows, { label: `Item ${rows.length + 1}`, value: 0 }])} type="button">
            <Plus size={13} /> Add row
          </button>
          <p className="chart-help">Paste CSV or spreadsheet cells into any label field. Up to 24 rows.</p>
        </div>
      ) : null}

      {tab === "style" ? (
        <div className="chart-tab-panel">
          <div className="chart-control-label"><strong>Palette</strong><span>Applies to every data mark</span></div>
          <div className="chart-palette-grid">
            {motionDocChartPaletteNames.map((palette) => {
              const selected = String(block.props.palette ?? "aurora") === palette;
              return (
                <button aria-pressed={selected} className={selected ? "is-selected" : ""} key={palette} onClick={() => updateChart({ palette })} type="button">
                  <span className="palette-dots">{chartPalettes[palette].map((color) => <i key={color} style={{ background: color }} />)}</span>
                  <span>{palette}</span>
                  {selected ? <Check size={11} /> : null}
                </button>
              );
            })}
          </div>
          <div className="chart-toggle-grid">
            <ChartToggle active={String(block.props.showAxes ?? "true") !== "false"} description="Grid and scale" label="Axes" onChange={(active) => updateChart({ showAxes: String(active) })} />
            <ChartToggle active={String(block.props.showLabels ?? "true") !== "false"} description="Values and names" label="Labels" onChange={(active) => updateChart({ showLabels: String(active) })} />
          </div>
          <label className="field field-wide chart-aria-field">
            <span>Accessible description</span>
            <input defaultValue={String(block.props.ariaLabel ?? "")} onBlur={(event) => updateChart({ ariaLabel: event.currentTarget.value.trim() })} placeholder="Quarterly revenue by region" />
          </label>
        </div>
      ) : null}

      {tab === "motion" ? (
        <div className="chart-tab-panel">
          <div className="chart-control-label"><strong>Build animation</strong><span>Plays when the slide becomes active</span></div>
          <div className="chart-motion-list">
            {motionDocChartMotions.map((motion) => {
              const selected = String(block.props.chartMotion ?? "auto") === motion;
              return (
                <button aria-pressed={selected} className={selected ? "is-selected" : ""} key={motion} onClick={() => {
                  updateChart({ chartMotion: motion });
                  window.setTimeout(() => onPreviewMotion?.(), 0);
                }} type="button">
                  <MotionGlyph motion={motion} />
                  <span><strong>{motionCopy[motion].label}</strong><small>{motionCopy[motion].detail}</small></span>
                  {selected ? <Check size={12} /> : null}
                </button>
              );
            })}
          </div>
          <p className="chart-help">Animation is disabled automatically when the viewer requests reduced motion. PPTX exports the matching editable final state.</p>
        </div>
      ) : null}
    </section>
  );
}

function ChartToggle({ active, description, label, onChange }: { active: boolean; description: string; label: string; onChange: (active: boolean) => void }) {
  return (
    <button aria-pressed={active} className={active ? "is-selected" : ""} onClick={() => onChange(!active)} type="button">
      <span><strong>{label}</strong><small>{description}</small></span><i><b /></i>
    </button>
  );
}

function ChartGlyph({ type }: { type: MotionDocChartType }) {
  if (type === "pie" || type === "donut") return <svg aria-hidden="true" viewBox="0 0 32 24"><circle cx="16" cy="12" fill="none" r="8" stroke="currentColor" strokeWidth={type === "donut" ? 4 : 8} strokeDasharray="34 16" transform="rotate(-90 16 12)" /></svg>;
  if (type === "bar") return <svg aria-hidden="true" viewBox="0 0 32 24"><path d="M5 20V12h5v8M14 20V5h5v15M23 20V9h5v11" fill="currentColor" opacity=".86" /></svg>;
  if (type === "scatter") return <svg aria-hidden="true" viewBox="0 0 32 24"><circle cx="8" cy="16" r="2.5" fill="currentColor" /><circle cx="16" cy="9" r="3.5" fill="currentColor" opacity=".72" /><circle cx="25" cy="14" r="2" fill="currentColor" opacity=".5" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 32 24"><path d="M4 18 11 11l6 3 10-9" fill={type === "area" ? "currentColor" : "none"} fillOpacity=".16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /><path d="M4 20h24" stroke="currentColor" strokeOpacity=".2" /></svg>;
}

function MotionGlyph({ motion }: { motion: MotionDocChartMotion }) {
  return <span className={`motion-glyph motion-glyph-${motion}`} aria-hidden="true"><i /><i /><i /></span>;
}

function parseTable(value: string, type: MotionDocChartType): MotionDocChartDatum[] {
  return value.trim().split(/\r?\n/).slice(0, 24).flatMap((line, index) => {
    const cells = line.split(line.includes("\t") ? "\t" : ",").map((cell) => cell.trim());
    if (!cells.length) return [];
    const numeric = cells.slice(1).map((cell) => Number(cell));
    if (!Number.isFinite(numeric[0])) return [];
    return [{
      label: cells[0] || `Item ${index + 1}`,
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

function finite(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function mergeChartProps(block: MotionDocBlock, patch: MotionDocProps): MotionDocProps {
  return { ...block.props, ...patch };
}
