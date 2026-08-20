import { useEffect, useState } from "react";
import { Dithering } from "@paper-design/shaders-react";
import { ArrowRight, Check, ChevronLeft, FilePlus2, LayoutGrid, MonitorPlay, Sparkles } from "lucide-react";

type OnboardingCopy = {
  eyebrow: string;
  finish: string;
  next: string;
  previous: string;
  skip: string;
  steps: Array<{
    action: string;
    body: string;
    kicker: string;
    title: string;
  }>;
};

const copy: Record<"en" | "zh-TW", OnboardingCopy> = {
  en: {
    eyebrow: "Your first deck, locally",
    finish: "Enter Workspace",
    next: "Next",
    previous: "Back",
    skip: "Skip for now",
    steps: [
      { action: "Choose how to start", body: "Begin with a blank canvas or a template. Your presentation stays in this local workspace from the first slide onward.", kicker: "01 — Create", title: "Start with the idea." },
      { action: "Edit on the canvas", body: "Select, move, and refine every layer directly on the slide. What you see on the canvas stays in sync with MotionDoc.", kicker: "02 — Edit", title: "See it. Shape it." },
      { action: "Ready to share", body: "Play through the complete story, then export editable PPTX, interactive HTML, or the MotionDoc MDX source.", kicker: "03 — Preview & export", title: "Share it your way." }
    ]
  },
  "zh-TW": {
    eyebrow: "從你的第一份簡報開始",
    finish: "進入工作區",
    next: "下一步",
    previous: "上一步",
    skip: "稍後再說",
    steps: [
      { action: "選擇開始方式", body: "從空白畫布或模板開始；從第一頁起，所有內容都會留在這個本機工作區。", kicker: "01 — 建立", title: "從一個想法開始。" },
      { action: "直接在畫布上編輯", body: "在投影片上選取、移動並調整每個圖層；畫布內容會與 MotionDoc 保持一致。", kicker: "02 — 編輯", title: "看見它，調整它。" },
      { action: "準備好分享", body: "先播放完整簡報，再輸出可編輯的 PPTX、互動式 HTML，或 MotionDoc MDX 原始碼。", kicker: "03 — 預覽與輸出", title: "用你的方式分享。" }
    ]
  }
};

export function WorkspaceOnboarding({
  locale,
  onComplete,
  onCreateBlank,
  onShowTemplates,
  onStep,
  step
}: {
  locale: "en" | "zh-TW";
  onComplete(): void;
  onCreateBlank(): void;
  onShowTemplates(): void;
  onStep(step: number): void;
  step: number;
}) {
  const t = copy[locale];
  const current = t.steps[step];
  const isLastStep = step === t.steps.length - 1;

  return (
    <div aria-labelledby="osx-onboarding-title" className="osx-onboarding" role="dialog" aria-modal="true">
      <OnboardingShader />
      <div className="osx-onboarding-noise" />
      <section className={`osx-onboarding-panel is-step-${step}`}>
        <header className="osx-onboarding-header">
          <div className="osx-onboarding-brand"><Sparkles size={15} /><span>OpenSlideX</span></div>
          <button className="osx-onboarding-skip" onClick={onComplete} type="button">{t.skip}</button>
        </header>

        <div className="osx-onboarding-content">
          <div className="osx-onboarding-copy">
            <span className="osx-onboarding-eyebrow">{t.eyebrow}</span>
            <p className="osx-onboarding-kicker">{current.kicker}</p>
            <h1 id="osx-onboarding-title">{current.title}</h1>
            <p className="osx-onboarding-body">{current.body}</p>
            {step === 0 ? (
              <div className="osx-onboarding-start-options">
                <button onClick={onCreateBlank} type="button"><FilePlus2 size={16} /><span><strong>{locale === "zh-TW" ? "從空白開始" : "Start from blank"}</strong><small>{locale === "zh-TW" ? "先放上第一個想法。" : "Place the first idea."}</small></span><ArrowRight size={15} /></button>
                <button onClick={onShowTemplates} type="button"><LayoutGrid size={16} /><span><strong>{locale === "zh-TW" ? "使用模板開始" : "Start with a template"}</strong><small>{locale === "zh-TW" ? "從完整的視覺方向開始。" : "Begin with a visual direction."}</small></span><ArrowRight size={15} /></button>
              </div>
            ) : null}
            {step === 2 ? <p className="osx-onboarding-action"><Check size={15} />{current.action}</p> : null}
          </div>

          <OnboardingScene step={step} />
        </div>

        <footer className="osx-onboarding-footer">
          <div aria-label={locale === "zh-TW" ? "導覽進度" : "Tour progress"} className="osx-onboarding-progress">
            {t.steps.map((item, index) => <button aria-label={item.title} className={index === step ? "is-active" : index < step ? "is-complete" : ""} key={item.kicker} onClick={() => onStep(index)} type="button"><i /></button>)}
          </div>
          <div className="osx-onboarding-actions">
            {step > 0 ? <button className="osx-onboarding-back" onClick={() => onStep(step - 1)} type="button"><ChevronLeft size={16} />{t.previous}</button> : null}
            <button className="osx-onboarding-next" onClick={() => isLastStep ? onComplete() : onStep(step + 1)} type="button">{isLastStep ? t.finish : t.next}<ArrowRight size={16} /></button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function OnboardingShader() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div aria-hidden="true" className="osx-onboarding-shader">
      <Dithering
        colorBack="#070711"
        colorFront="#9a82ff"
        fit="cover"
        maxPixelCount={960 * 540}
        offsetX={0.08}
        offsetY={-0.08}
        scale={0.86}
        shape="warp"
        size={3}
        speed={reducedMotion ? 0 : 0.055}
        type="4x4"
      />
    </div>
  );
}

function OnboardingScene({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div aria-hidden="true" className="osx-onboarding-scene osx-onboarding-scene-start">
        <div className="osx-orbit osx-orbit-one" /><div className="osx-orbit osx-orbit-two" />
        <div className="osx-deck-stack">
          <i /><i /><i />
          <div className="osx-deck-cover">
            <div className="osx-deck-cover-grid" />
            <div className="osx-deck-cover-meta"><span>01 / 08</span><span>OPENSLIDEX</span></div>
            <strong>New<br />story</strong>
            <div className="osx-deck-cover-footer"><em /><span>FIRST DRAFT</span></div>
          </div>
        </div>
        <div className="osx-deck-chip chip-one"><FilePlus2 size={14} />Blank</div>
        <div className="osx-deck-chip chip-two"><LayoutGrid size={14} />Template</div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div aria-hidden="true" className="osx-onboarding-scene osx-onboarding-scene-canvas">
        <div className="osx-canvas-window"><div className="osx-canvas-bar"><i /><i /><i /><span /></div><div className="osx-canvas-body"><aside><i /><i /><i /><i /></aside><main><div className="osx-canvas-title" /><div className="osx-canvas-shape" /><div className="osx-canvas-line" /><div className="osx-canvas-photo" /></main></div></div>
        <div className="osx-canvas-cursor" /><div className="osx-canvas-pulse" />
        <div className="osx-layer-chip"><MonitorPlay size={14} />Live canvas</div>
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="osx-onboarding-scene osx-onboarding-scene-export">
      <div className="osx-export-glow" /><div className="osx-export-page"><div /><div /><div /><span /></div>
      <div className="osx-export-format format-pptx">PPTX</div><div className="osx-export-format format-html">HTML</div><div className="osx-export-format format-mdx">MDX</div>
      <div className="osx-export-path"><i /><i /><i /></div>
    </div>
  );
}
