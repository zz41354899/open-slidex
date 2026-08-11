import { motionDocSlideSourceRanges } from "@/core/motion-doc/application/motionDocSourceEditor";
import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";

export type BundledTemplateLibrarySlide = {
  index: number;
  scene: MotionDocScene;
  source: string;
};

export type BundledTemplateLibraryDeck = {
  slides: BundledTemplateLibrarySlide[];
  source: string;
  templateId: string;
};

const publicStarterSources = {
  en: `# Untitled presentation

<Slide duration={6} fontSizeUnit="pt" theme="dark" background="#111827" accent="#A7F3D0" textColor="#F9FAFB" mutedColor="#CBD5E1" slideTransition="fade" transitionDuration={0.7} canvasHeight={1080} canvasWidth={1920}>
  <Text id="starter-1-kicker" fontSize={14} fontWeight={700} letterSpacing={1.2} x={7} y={8} w={34} h={5} color="#A7F3D0">PROJECT STARTER / 01</Text>
  <Title id="starter-1-title" fontSize={58} fontWeight={700} lineHeight={1.08} x={7} y={28} w={62} h={24} color="#F9FAFB">Start with one clear question.</Title>
  <Text id="starter-1-body" fontSize={20} lineHeight={1.5} x={7} y={58} w={42} h={13} color="#CBD5E1">Replace this example with your point, evidence, and next action.</Text>
</Slide>

<Slide duration={6} fontSizeUnit="pt" theme="light" background="#F8FAFC" accent="#111827" textColor="#111827" mutedColor="#475569" slideTransition="pushLeft" transitionDuration={0.7} canvasHeight={1080} canvasWidth={1920}>
  <Text id="starter-2-kicker" fontSize={14} fontWeight={700} letterSpacing={1.2} x={7} y={8} w={34} h={5} color="#0F766E">PROJECT STARTER / 02</Text>
  <Title id="starter-2-title" fontSize={48} fontWeight={700} lineHeight={1.12} x={7} y={18} w={55} h={19} color="#111827">Let every slide move one decision forward.</Title>
  <Text id="starter-2-body" fontSize={19} lineHeight={1.5} x={7} y={43} w={42} h={12} color="#475569">Point → evidence → next step.</Text>
</Slide>`,
  "zh-TW": `# 未命名簡報

<Slide duration={6} fontSizeUnit="pt" theme="dark" background="#111827" accent="#A7F3D0" textColor="#F9FAFB" mutedColor="#CBD5E1" slideTransition="fade" transitionDuration={0.7} canvasHeight={1080} canvasWidth={1920}>
  <Text id="starter-1-kicker" fontSize={14} fontWeight={700} letterSpacing={1.2} x={7} y={8} w={34} h={5} color="#A7F3D0">PROJECT STARTER / 01</Text>
  <Title id="starter-1-title" fontSize={58} fontWeight={700} lineHeight={1.08} x={7} y={28} w={62} h={24} color="#F9FAFB">從一個清楚的問題開始。</Title>
  <Text id="starter-1-body" fontSize={20} lineHeight={1.5} x={7} y={58} w={42} h={13} color="#CBD5E1">把這份範例換成你的觀點、證據與下一步。</Text>
</Slide>

<Slide duration={6} fontSizeUnit="pt" theme="light" background="#F8FAFC" accent="#111827" textColor="#111827" mutedColor="#475569" slideTransition="pushLeft" transitionDuration={0.7} canvasHeight={1080} canvasWidth={1920}>
  <Text id="starter-2-kicker" fontSize={14} fontWeight={700} letterSpacing={1.2} x={7} y={8} w={34} h={5} color="#0F766E">PROJECT STARTER / 02</Text>
  <Title id="starter-2-title" fontSize={48} fontWeight={700} lineHeight={1.12} x={7} y={18} w={55} h={19} color="#111827">讓每一頁推進一個決定。</Title>
  <Text id="starter-2-body" fontSize={19} lineHeight={1.5} x={7} y={43} w={42} h={12} color="#475569">觀點 → 證據 → 下一步。</Text>
</Slide>`
} as const;

export function getBundledTemplateLibrarySource(templateId: string, locale: "zh-TW" | "en") {
  return templateId === "open-slidex-starter" ? publicStarterSources[locale] : undefined;
}

export function getBundledTemplateLibraryBlankSource(templateId: string, locale: "zh-TW" | "en") {
  const source = getBundledTemplateLibrarySource(templateId, locale);
  const firstSlide = source ? motionDocSlideSourceRanges(source)[0] : undefined;
  const tagName = firstSlide?.source.match(/^<(Slide|Scene)\b/)?.[1];
  return firstSlide && tagName ? `# Untitled\n\n${firstSlide.openingTag}\n</${tagName}>` : undefined;
}

export function getBundledTemplateLibraryDeck(templateId: string, locale: "zh-TW" | "en"): BundledTemplateLibraryDeck | undefined {
  const source = getBundledTemplateLibrarySource(templateId, locale);
  if (!source) return undefined;
  const scenes = parseMotionDoc(source).scenes;
  const slides = motionDocSlideSourceRanges(source).flatMap((range, index): BundledTemplateLibrarySlide[] => {
    const scene = scenes[index];
    return scene ? [{ index, scene, source: range.source }] : [];
  });
  return slides.length ? { slides, source, templateId } : undefined;
}
