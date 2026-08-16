
import { Check, ChevronLeft, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getBundledTemplateLibraryDeck,
  type BundledTemplateLibrarySlide
} from "@/core/motion-doc/presets/templateLibrarySources";
import {
  getTemplateLibraryItemById,
  getTemplateLibraryItems,
  type TemplateLibraryLocale
} from "@/features/template-library/domain/templateLibrary";
import { SlideThumbnailPreview } from "@/features/pitch/ui/preview/SlideThumbnailPreview";

type TemplateLibrarySlidePanelProps = {
  activeTemplateId?: string;
  isMobile?: boolean;
  locale: TemplateLibraryLocale;
  onAddBlank: () => void;
  onAddTemplateSlide: (templateId: string, slideSource: string) => void;
  onApplyTemplateDeck: (templateId: string, slideSources: string[]) => void;
  onClose: () => void;
  replayNonce: number;
};

type TemplatePanelView = "catalog" | "slides";

export function TemplateLibrarySlidePanel({
  activeTemplateId,
  isMobile = false,
  locale,
  onAddBlank,
  onAddTemplateSlide,
  onApplyTemplateDeck,
  onClose,
  replayNonce
}: TemplateLibrarySlidePanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const templates = useMemo(() => getTemplateLibraryItems(locale), [locale]);
  const initialTemplateId = templates.some((template) => template.id === activeTemplateId)
    ? activeTemplateId
    : templates[0]?.id;
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId ?? "");
  const [panelView, setPanelView] = useState<TemplatePanelView>("catalog");
  const item = useMemo(
    () => getTemplateLibraryItemById(selectedTemplateId, locale),
    [locale, selectedTemplateId]
  );
  const deck = useMemo(
    () => getBundledTemplateLibraryDeck(selectedTemplateId, locale),
    [locale, selectedTemplateId]
  );
  const copy = locale === "zh-TW"
    ? {
        addBlank: "新增空白投影片",
        addSlide: "新增",
        applyDeck: "套用整份模板",
        back: "返回模板總覽",
        choose: "選擇模板",
        close: "關閉模板面板",
        slide: "投影片",
        templates: "模板",
        unavailable: "找不到這份模板的投影片。"
      }
    : {
        addBlank: "Add blank slide",
        addSlide: "Add",
        applyDeck: "Apply template to deck",
        back: "Back to templates",
        choose: "Choose a template",
        close: "Close template panel",
        slide: "Slide",
        templates: "Templates",
        unavailable: "The slides for this template are unavailable."
      };

  useEffect(() => {
    if (isMobile) return;

    function closeWhenClickingOutside(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-slide-library-trigger]")) return;
      onClose();
    }

    document.addEventListener("pointerdown", closeWhenClickingOutside, true);
    return () => document.removeEventListener("pointerdown", closeWhenClickingOutside, true);
  }, [isMobile, onClose]);

  return (
    <aside
      aria-label={copy.templates}
      className={`flex h-full shrink-0 flex-col overflow-hidden border-r border-white/[0.1] bg-[#101010] shadow-[18px_0_48px_rgba(0,0,0,0.38)] ${isMobile ? "w-full" : "w-[min(620px,52vw)]"}`}
      ref={panelRef}
    >
      <header className="flex h-[52px] shrink-0 items-end justify-between border-b border-white/[0.08] px-4">
        <span className="border-b-2 border-white px-1 pb-3 text-[13px] font-semibold text-white">
          {copy.templates}
        </span>
        <button aria-label={copy.close} className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/[0.07] hover:text-white" onClick={onClose} type="button">
          <X size={15} />
        </button>
      </header>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
        {panelView === "catalog" ? (
          <section aria-labelledby="template-picker-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[11px] font-semibold text-white/55" id="template-picker-title">
                {copy.choose}
              </h2>
              <button
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[11px] font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
                onClick={onAddBlank}
                type="button"
              >
                <Plus size={13} />
                {copy.addBlank}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((template) => {
                const templateDeck = getBundledTemplateLibraryDeck(template.id, locale);
                const isCurrentTemplate = template.id === activeTemplateId;
                const firstSlide = templateDeck?.slides[0];

                return (
                  <button
                    aria-label={template.name}
                    className={`group relative overflow-hidden rounded-xl border text-left transition active:scale-[0.985] ${isCurrentTemplate ? "border-white/60 bg-white/[0.08]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]"}`}
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      setPanelView("slides");
                    }}
                    type="button"
                  >
                    <div className="relative aspect-video overflow-hidden bg-black">
                      {firstSlide && templateDeck ? (
                        <SlideThumbnailPreview
                          activeSlideIndex={0}
                          eager
                          replayNonce={replayNonce}
                          scene={firstSlide.scene}
                        />
                      ) : null}
                      {isCurrentTemplate ? (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-black shadow-lg">
                          <Check size={13} strokeWidth={2.5} />
                        </span>
                      ) : null}
                    </div>
                    <span className="block truncate px-2.5 py-2 text-[10px] font-semibold text-white/65 group-hover:text-white">
                      {template.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : item && deck ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  aria-label={copy.back}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/[0.07] hover:text-white active:scale-[0.96]"
                  onClick={() => setPanelView("catalog")}
                  title={copy.back}
                  type="button"
                >
                  <ChevronLeft size={17} />
                </button>
                <div className="min-w-0">
                  <h2 className="truncate text-[14px] font-semibold text-white">{item.name}</h2>
                  <p className="mt-1 text-[10px] text-neutral-500">{deck.slides.length} {copy.slide}</p>
                </div>
              </div>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-[12px] font-semibold text-black transition hover:bg-white/85 active:scale-[0.98]"
                onClick={() => onApplyTemplateDeck(selectedTemplateId, deck.slides.map((slide) => slide.source))}
                type="button"
              >
                <Check className="h-4 w-4" strokeWidth={2.2} />
                {copy.applyDeck}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {deck.slides.map((slide) => (
                <TemplateSlideCard
                  copy={copy}
                  key={slide.index}
                  locale={locale}
                  onSelect={() => onAddTemplateSlide(selectedTemplateId, slide.source)}
                  replayNonce={replayNonce}
                  slide={slide}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-white/10 px-5 text-center text-[12px] text-white/40">
            {copy.unavailable}
          </div>
        )}
      </div>
    </aside>
  );
}

type TemplatePanelCopy = {
  addBlank: string;
  addSlide: string;
  applyDeck: string;
  back: string;
  choose: string;
  close: string;
  slide: string;
  templates: string;
  unavailable: string;
};

function TemplateSlideCard({
  copy,
  locale,
  onSelect,
  replayNonce,
  slide
}: {
  copy: TemplatePanelCopy;
  locale: TemplateLibraryLocale;
  onSelect: () => void;
  replayNonce: number;
  slide: BundledTemplateLibrarySlide;
}) {
  return (
    <article className="group overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.018] transition hover:border-white/30 hover:bg-white/[0.04]">
      <button
        aria-label={`${copy.addSlide}: ${copy.slide} ${slide.index + 1}`}
        className="block w-full text-left active:scale-[0.985]"
        onClick={onSelect}
        type="button"
      >
        <div className="relative aspect-video overflow-hidden bg-black">
        <SlideThumbnailPreview
          activeSlideIndex={slide.index}
          eager={slide.index < 3}
          replayNonce={replayNonce}
          scene={slide.scene}
        />
        </div>
      </button>
      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-2.5 py-2">
        <span className="text-[10px] font-semibold text-neutral-400 transition group-hover:text-white">
          {locale === "zh-TW" ? `投影片 ${slide.index + 1}` : `Slide ${slide.index + 1}`}
        </span>
        <button className="rounded-md px-2 py-1 text-[10px] font-medium text-white/55 transition hover:bg-white/[0.08] hover:text-white" onClick={onSelect} type="button">
          {copy.addSlide}
        </button>
      </div>
    </article>
  );
}
