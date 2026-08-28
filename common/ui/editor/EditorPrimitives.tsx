
import { Check, ChevronDown, Download, Layers, PanelRight, Play, Redo2, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import styles from "./EditorPrimitives.module.css";

export type EditorZoomLevel = number | "fit";

export type EditorHeaderBadge = {
  label: string;
  tone?: "default" | "guest" | "local";
};

export type EditorHeaderProps = {
  actualScale: number;
  badge?: EditorHeaderBadge;
  brand: ReactNode;
  centerContent?: ReactNode;
  exportOptions?: readonly { id: string; label: string; description?: string }[];
  exportInteraction?: "format-menu" | "split";
  exportButtonRef?: RefObject<HTMLDivElement | null>;
  isMobileInspectorOpen?: boolean;
  isMobileSidebarOpen?: boolean;
  labels?: Partial<{
    chooseExportFormat: string;
    export: string;
    fitToScreen: string;
    play: string;
    redo: string;
    replayAnimations: string;
    renamePresentation: string;
    toggleInspector: string;
    toggleSidebar: string;
    undo: string;
  }>;
  notice?: string;
  noticeTone?: "danger" | "default" | "warning";
  onExport: () => void;
  onExportOption?: (id: string) => void;
  onPlay: () => void;
  onReplay?: () => void;
  onProjectNameChange?: (value: string) => void;
  onRedo?: () => void;
  onToggleInspector: () => void;
  onToggleSidebar: () => void;
  onUndo: () => void;
  projectName: string;
  projectNameEditValue?: string;
  redoDisabled?: boolean;
  setZoomLevel: (value: EditorZoomLevel) => void;
  showFitScale?: boolean;
  undoDisabled?: boolean;
  variant?: "default" | "local";
  zoomLevel: EditorZoomLevel;
};

const zoomOptions = ["fit", 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function EditorHeader({
  actualScale,
  badge,
  brand,
  centerContent,
  exportOptions,
  exportInteraction = "split",
  exportButtonRef,
  isMobileInspectorOpen,
  isMobileSidebarOpen,
  labels: labelOverrides,
  notice,
  noticeTone,
  onExport,
  onExportOption,
  onPlay,
  onReplay,
  onProjectNameChange,
  onRedo,
  onToggleInspector,
  onToggleSidebar,
  onUndo,
  projectName,
  projectNameEditValue,
  redoDisabled,
  setZoomLevel,
  showFitScale = true,
  undoDisabled,
  variant = "default",
  zoomLevel
}: EditorHeaderProps) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(projectNameEditValue ?? projectName);
  const zoomRef = useRef<HTMLDivElement>(null);
  const localExportRef = useRef<HTMLDivElement>(null);
  const cancelProjectNameRef = useRef(false);
  const labels = {
    chooseExportFormat: labelOverrides?.chooseExportFormat ?? "Choose export format",
    export: labelOverrides?.export ?? "Export",
    fitToScreen: labelOverrides?.fitToScreen ?? "Fit to screen",
    play: labelOverrides?.play ?? "Play",
    redo: labelOverrides?.redo ?? "Redo",
    replayAnimations: labelOverrides?.replayAnimations ?? "Replay animations",
    renamePresentation: labelOverrides?.renamePresentation ?? "Rename presentation",
    toggleInspector: labelOverrides?.toggleInspector ?? "Toggle inspector",
    toggleSidebar: labelOverrides?.toggleSidebar ?? "Toggle slides and layers",
    undo: labelOverrides?.undo ?? "Undo"
  };

  useEffect(() => {
    if (!editingProjectName) setProjectNameDraft(projectNameEditValue ?? projectName);
  }, [editingProjectName, projectName, projectNameEditValue]);

  function commitProjectName() {
    const next = projectNameDraft.trim();
    if (next && next !== (projectNameEditValue ?? projectName)) onProjectNameChange?.(next);
    setEditingProjectName(false);
  }

  useEffect(() => {
    if (!zoomOpen) return;
    function close(event: MouseEvent) {
      if (!zoomRef.current?.contains(event.target as Node)) setZoomOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setZoomOpen(false);
    }
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [zoomOpen]);

  useEffect(() => {
    if (!exportOpen) return;
    function close(event: MouseEvent) {
      if (!localExportRef.current?.contains(event.target as Node)) setExportOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setExportOpen(false);
    }
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [exportOpen]);

  return (
    <header className={styles.header} data-editor-header-variant={variant}>
      <div className={styles.headerLeft}>
        <button
          aria-label={labels.toggleSidebar}
          aria-pressed={isMobileSidebarOpen}
          className={styles.mobileButton}
          onClick={onToggleSidebar}
          type="button"
        >
          <Layers size={15} />
        </button>
        <div className={styles.brandGroup}>
          <span className={styles.brand}>{brand}</span>
          {badge ? (
            <span className={`${styles.badge} ${badge.tone === "local" ? styles.badgeLocal : badge.tone === "guest" ? styles.badgeGuest : ""}`}>
              {badge.label}
            </span>
          ) : null}
          <span className={styles.divider} />
          {onProjectNameChange ? editingProjectName ? (
            <input
              aria-label={labels.renamePresentation}
              autoFocus
              className={styles.projectNameInput}
              maxLength={80}
              onBlur={() => {
                if (cancelProjectNameRef.current) {
                  cancelProjectNameRef.current = false;
                  setEditingProjectName(false);
                  return;
                }
                commitProjectName();
              }}
              onChange={(event) => setProjectNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  cancelProjectNameRef.current = true;
                  setProjectNameDraft(projectNameEditValue ?? projectName);
                  event.currentTarget.blur();
                }
              }}
              value={projectNameDraft}
            />
          ) : (
            <button
              aria-label={labels.renamePresentation}
              className={`${styles.projectName} ${styles.projectNameButton}`}
              onClick={() => setEditingProjectName(true)}
              title={labels.renamePresentation}
              type="button"
            >
              {projectName}
            </button>
          ) : <strong className={styles.projectName}>{projectName}</strong>}
        </div>
      </div>

      {centerContent ? <div className={styles.headerCenter}>{centerContent}</div> : null}

      <div className={styles.headerRight}>
        {notice ? (
          <span className={`${styles.notice} ${noticeTone === "warning" ? styles.noticeWarning : noticeTone === "danger" ? styles.noticeDanger : ""}`} title={notice}>
            {notice}
          </span>
        ) : null}
        <div className={styles.actionGroup}>
          <button aria-label={labels.undo} className={styles.actionButton} disabled={undoDisabled} onClick={onUndo} title={labels.undo} type="button">
            <Undo2 size={15} /><span>{labels.undo}</span>
          </button>
          {onRedo ? <button aria-label={labels.redo} className={styles.actionButton} disabled={redoDisabled} onClick={onRedo} title={labels.redo} type="button">
            <Redo2 size={15} /><span>{labels.redo}</span>
          </button> : null}
        </div>
        <div className={styles.zoom} ref={zoomRef}>
          <button aria-expanded={zoomOpen} className={styles.zoomButton} data-canvas-zoom-trigger onClick={() => setZoomOpen((value) => !value)} type="button">
            <span>{zoomLabel(zoomLevel, actualScale, labels.fitToScreen, showFitScale)}</span>
            <ChevronDown size={14} />
          </button>
          {zoomOpen ? (
            <div className={styles.zoomMenu} role="menu">
              {zoomOptions.map((option) => (
                <button
                  className={`${styles.zoomOption} ${zoomLevel === option ? styles.zoomOptionSelected : ""}`}
                  data-canvas-zoom-option={option}
                  key={option}
                  onClick={() => {
                    setZoomLevel(option);
                    setZoomOpen(false);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <span>{option === "fit" ? labels.fitToScreen : `${option * 100}%`}</span>
                  {zoomLevel === option ? <Check size={14} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button className={`${styles.actionButton} ${styles.playButton}`} onClick={onPlay} type="button">
            <Play fill="currentColor" size={14} /><span>{labels.play}</span>
        </button>
        {onReplay ? (
          <button aria-label={labels.replayAnimations} className={styles.actionButton} onClick={onReplay} title={labels.replayAnimations} type="button">
            <Sparkles size={16} /><span>{labels.replayAnimations}</span>
          </button>
        ) : null}
        <div className={styles.exportControl} ref={(node) => {
          localExportRef.current = node;
          if (exportButtonRef && "current" in exportButtonRef) exportButtonRef.current = node;
        }}>
          <button
            aria-expanded={exportInteraction === "format-menu" && exportOptions?.length ? exportOpen : undefined}
            aria-haspopup={exportInteraction === "format-menu" && exportOptions?.length ? "menu" : undefined}
            className={`${styles.exportButton} ${exportInteraction === "format-menu" ? styles.exportButtonMenu : ""}`}
            onClick={exportInteraction === "format-menu" && exportOptions?.length ? () => setExportOpen((value) => !value) : onExport}
            type="button"
          >
            <Download size={14} /><span className={styles.exportLabel}>{labels.export}</span>
            {exportInteraction === "format-menu" && exportOptions?.length ? <ChevronDown size={14} /> : null}
          </button>
          {exportInteraction === "split" && exportOptions?.length ? <button aria-expanded={exportOpen} aria-label={labels.chooseExportFormat} className={styles.exportChevron} onClick={() => setExportOpen((value) => !value)} type="button"><ChevronDown size={14} /></button> : null}
          {exportOpen && exportOptions?.length ? <div className={styles.exportMenu} role="menu">
            {exportOptions.map((option) => <button key={option.id} onClick={() => { onExportOption?.(option.id); setExportOpen(false); }} role="menuitem" type="button"><span>{option.label}</span>{option.description ? <small>{option.description}</small> : null}</button>)}
          </div> : null}
        </div>
        <button
          aria-label={labels.toggleInspector}
          aria-pressed={isMobileInspectorOpen}
          className={styles.mobileButton}
          onClick={onToggleInspector}
          type="button"
        >
          <PanelRight size={15} />
        </button>
      </div>
    </header>
  );
}

export function EditorPanelTabs<T extends string>({
  ariaLabel,
  onChange,
  options,
  value
}: {
  ariaLabel: string;
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  value: T;
}) {
  return (
    <div aria-label={ariaLabel} className={styles.tabs} role="tablist">
      {options.map((option) => (
        <button
          aria-selected={option.value === value}
          className={`${styles.tab} ${option.value === value ? styles.tabSelected : ""}`}
          key={option.value}
          onClick={() => onChange(option.value)}
          role="tab"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function EditorInspectorHeader({ actions, subtitle, title }: { actions?: ReactNode; subtitle?: string; title: string }) {
  return (
    <div className={styles.inspectorHeader}>
      <div className={styles.inspectorHeading}>
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      {actions ? <div className={styles.inspectorActions}>{actions}</div> : null}
    </div>
  );
}

function zoomLabel(level: EditorZoomLevel, actualScale: number, fitLabel: string, showFitScale: boolean) {
  if (level !== "fit") return `${Math.round(level * 100)}%`;
  if (!showFitScale) return fitLabel.replace(/ to screen$/i, "");
  const percent = actualScale * 100;
  return `${fitLabel.replace(/ to screen$/i, "")} ${percent < 10 ? Math.round(percent * 10) / 10 : Math.round(percent)}%`;
}
