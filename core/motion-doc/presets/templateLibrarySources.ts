import { stripNonLocalMotionDocMedia } from "@/core/motion-doc/application/localMediaPolicy";
import { materializeFreeformSource } from "@/core/motion-doc/application/motionDocFreeform";
import { motionDocSlideSourceRanges } from "@/core/motion-doc/application/motionDocSourceEditor";
import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { motionTemplates } from "@/core/motion-doc/presets/templates";

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

const summerTimeReportSource = `# Summer Time Report

<Slide duration={5} fontSizeUnit="pt" theme="light" background="#38BDF8" accent="#0A84FF" textColor="#FFFFFF" mutedColor="#DFF6FF" canvasHeight={1080} canvasWidth={1920} slideTransition="fade" transitionDuration={0.7} shader="mesh-gradient" shaderEngine="three" shaderPreset="Beach" shaderFrame={18897} shaderSpeed={0} shaderScale={1} shaderIntensity={0.8} shaderSoftness={0.35} shaderDetail={0} shaderAngle={0} shaderColor1="#BCECF6" shaderColor2="#00AAFF" shaderColor3="#00F7FF" shaderColor4="#FFD447" shaderColor5="#BCECF6" shaderColor6="#FFFFFF">
  <Text id="cover-kicker" x={7} y={11} w={52} h={6} fontFamily="Arial" fontWeight={700} fontSize={15} letterSpacing={0.5} enter="fadeIn" delay={0.08} color="#6366f1">SUMMER 2026 | SUMMIT | TOOLKIT</Text>
  <Text id="cover-title-line-one" x={6.6} y={46.4} w={72} h={14} fontFamily="Arial" fontWeight={700} fontSize={68} lineHeight={1} enter="rise" delay={0.16} color="#6366f1">Summer Time</Text>
  <Text id="cover-title-line-two" x={6.6} y={63.4} w={86.8} h={14} fontFamily="Arial" fontWeight={700} fontSize={68} lineHeight={1} enter="rise" delay={0.26} color="#6366f1">Report</Text>
  <Text id="cover-caption" x={7} y={84} w={55} h={6} fontFamily="Arial" fontWeight={400} fontSize={18} lineHeight={1.2} enter="fadeUp" delay={0.38} color="#6366f1">A clear recap of what moved the season forward.</Text>
</Slide>

<Slide duration={5} fontSizeUnit="pt" theme="light" background="#F2FAFF" accent="#0A84FF" textColor="#223E53" mutedColor="#656565" canvasHeight={1080} canvasWidth={1920} slideTransition="pushLeft" transitionDuration={0.7}>
  <Text id="about-title" x={6.6} y={10} w={52} h={14} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={64} lineHeight={1} enter="rise">Who We Are</Text>
  <Text id="about-lede" x={6.8} y={35} w={45} h={20} color="#223E53" fontFamily="Arial" fontWeight={400} fontSize={24} lineHeight={1.25} enter="fadeUp" delay={0.14}>The starting point we use to align the work, the people, and the season ahead.</Text>
  <Shape id="about-orbit-one" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={68} y={21.9} w={9} h={16} radius={16} />
  <Shape id="about-orbit-two" shape="circle" fill="#4D81D2" stroke="transparent" strokeWidth={0} x={77} y={42} w={6} h={10.7} radius={16} />
  <Shape id="about-star" shape="star" fill="#38BDF8" stroke="transparent" strokeWidth={0} x={68.5} y={52.7} w={13} h={22} points={5} rotation={16} radius={16} />
  <Text id="about-tag" x={66} y={79} w={22} h={7} color="#656565" fontFamily="Arial" fontWeight={700} fontSize={14} lineHeight={1} textAlign="center">ONE SHARED BASELINE</Text>
</Slide>

<Slide duration={5} fontSizeUnit="pt" theme="light" background="#FFFFFF" accent="#0A84FF" textColor="#223E53" mutedColor="#656565" canvasHeight={1080} canvasWidth={1920} slideTransition="fade" transitionDuration={0.7}>
  <Text id="highlights-title" x={6.6} y={8} w={70} h={13} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={60} lineHeight={1} enter="rise">Highlights</Text>
  <Text id="highlights-subtitle" x={6.8} y={23} w={60} h={6} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={18} enter="fadeUp" delay={0.1}>Three moments that defined the season</Text>
  <Shape id="highlight-kickoff-surface" shape="rectangle" fill="#F2FAFF" stroke="#D7E9F2" strokeWidth={1.2} x={6.6} y={37} w={26} h={49} radius={20} enter="fadeUp" delay={0.18} />
  <Shape id="highlight-kickoff-icon" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={9} y={42} w={4.5} h={8} enter="pop" delay={0.26} radius={16} />
  <Text id="highlight-kickoff-title" x={9} y={54} w={21} h={7} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={22} lineHeight={1} enter="fadeUp" delay={0.24}>Season Kickoff</Text>
  <Text id="highlight-kickoff-copy" x={9} y={65} w={20} h={16} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={15} lineHeight={1.2} enter="fadeUp" delay={0.3}>New programs launched across every region, right on schedule.</Text>
  <Shape id="highlight-community-surface" shape="rectangle" fill="#F2FAFF" stroke="#D7E9F2" strokeWidth={1.2} x={37} y={37} w={26} h={49} radius={20} enter="fadeUp" delay={0.28} />
  <Shape id="highlight-community-icon" shape="parallelogram" fill="#4D81D2" stroke="transparent" strokeWidth={0} x={39.4} y={42} w={4.5} h={8} enter="pop" delay={0.36} radius={16} />
  <Text id="highlight-community-title" x={39.4} y={54} w={21} h={7} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={22} lineHeight={1} enter="fadeUp" delay={0.34}>Community Growth</Text>
  <Text id="highlight-community-copy" x={39.4} y={65} w={20} h={16} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={15} lineHeight={1.2} enter="fadeUp" delay={0.4}>More people joined this summer than in any season before it.</Text>
  <Shape id="highlight-standout-surface" shape="rectangle" fill="#F2FAFF" stroke="#D7E9F2" strokeWidth={1.2} x={67.3} y={37} w={26} h={49} radius={20} enter="fadeUp" delay={0.38} />
  <Shape id="highlight-standout-icon" shape="star" fill="#38BDF8" stroke="transparent" strokeWidth={0} x={69.5} y={41.5} w={5.2} h={9.2} points={5} rotation={12} enter="pop" delay={0.46} radius={16} />
  <Text id="highlight-standout-title" x={69.8} y={54} w={21} h={7} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={22} lineHeight={1} enter="fadeUp" delay={0.44}>Standout Moments</Text>
  <Text id="highlight-standout-copy" x={69.8} y={65} w={20} h={16} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={15} lineHeight={1.2} enter="fadeUp" delay={0.5}>A handful of projects carried the energy for the whole team.</Text>
  <Shape id="highlights-sun" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={89} y={6.5} w={6.9} h={12.2} radius={16} />
</Slide>

<Slide duration={5} fontSizeUnit="pt" theme="light" background="#F2FAFF" accent="#0A84FF" textColor="#223E53" mutedColor="#656565" canvasHeight={1080} canvasWidth={1920} slideTransition="fade" transitionDuration={0.7}>
  <Text id="numbers-title" x={6.6} y={8} w={72} h={13} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={60} lineHeight={1} enter="rise">By the Numbers</Text>
  <Text id="numbers-subtitle" x={6.8} y={23} w={60} h={6} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={18} enter="fadeUp" delay={0.1}>The signals that give this season its shape</Text>
  <Shape id="metric-reach-surface" shape="rectangle" fill="#FFFFFF" stroke="#D7E9F2" strokeWidth={1.2} x={6.6} y={36} w={18.5} h={53} radius={16} />
  <Text id="metric-reach-label" x={9} y={42} w={13.5} h={5} color="#656565" fontFamily="Arial" fontWeight={700} fontSize={14}>REACH</Text>
  <Text id="metric-reach-value" x={9} y={51} w={13.5} h={9} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={40} lineHeight={1}>128K</Text>
  <Text id="metric-reach-caption" x={9} y={64} w={13.5} h={20} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={13} lineHeight={1.15}>People reached across summer channels.</Text>
  <Shape id="metric-engagement-surface" shape="rectangle" fill="#FFFFFF" stroke="#D7E9F2" strokeWidth={1.2} x={27.6} y={36} w={18.5} h={53} radius={16} />
  <Text id="metric-engagement-label" x={30} y={42} w={13.5} h={5} color="#656565" fontFamily="Arial" fontWeight={700} fontSize={14}>ENGAGEMENT</Text>
  <Text id="metric-engagement-value" x={30} y={51} w={13.5} h={9} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={40} lineHeight={1}>42%</Text>
  <Text id="metric-engagement-caption" x={30} y={64} w={13.5} h={20} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={13} lineHeight={1.15}>Average engagement, up from spring.</Text>
  <Shape id="metric-completion-surface" shape="rectangle" fill="#FFFFFF" stroke="#D7E9F2" strokeWidth={1.2} x={48.6} y={36} w={18.5} h={53} radius={16} />
  <Text id="metric-completion-label" x={51} y={42} w={13.5} h={5} color="#656565" fontFamily="Arial" fontWeight={700} fontSize={14}>COMPLETION</Text>
  <Text id="metric-completion-value" x={51} y={51} w={13.5} h={9} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={40} lineHeight={1}>91%</Text>
  <Text id="metric-completion-caption" x={51} y={64} w={13.5} h={20} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={13} lineHeight={1.15}>Programs that finished on schedule.</Text>
  <Shape id="metric-team-surface" shape="rectangle" fill="#FFFFFF" stroke="#D7E9F2" strokeWidth={1.2} x={69.6} y={36} w={18.5} h={53} radius={16} />
  <Text id="metric-team-label" x={72} y={42} w={13.5} h={5} color="#656565" fontFamily="Arial" fontWeight={700} fontSize={14}>NEW TEAM</Text>
  <Text id="metric-team-value" x={72} y={51} w={13.5} h={9} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={40} lineHeight={1}>+12</Text>
  <Text id="metric-team-caption" x={72} y={64} w={13.5} h={20} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={13} lineHeight={1.15}>Contributors who joined this season.</Text>
  <Shape id="numbers-sun" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={89} y={6.5} w={6.9} h={12.2} radius={16} />
</Slide>

<Slide duration={5} fontSizeUnit="pt" theme="light" background="#FFFFFF" accent="#0A84FF" textColor="#223E53" mutedColor="#656565" canvasHeight={1080} canvasWidth={1920} slideTransition="pushLeft" transitionDuration={0.7}>
  <Text id="timeline-title" x={6.6} y={8} w={84} h={12} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={52} lineHeight={1} enter="rise">The Season, Step by Step</Text>
  <Shape id="timeline-line" shape="line" fill="transparent" stroke="#D8DEE3" strokeWidth={2} x={6.6} y={52} w={86.8} h={0.4} enter="reveal" delay={0.12} radius={16} />
  <Text id="timeline-kickoff-title" x={6.6} y={38} w={18} h={7} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={22}>Kickoff</Text>
  <Text id="timeline-kickoff-copy" x={6.6} y={57} w={18} h={13} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={16} lineHeight={1.2}>Plans locked, teams assigned, tools ready.</Text>
  <Shape id="timeline-kickoff-dot" shape="circle" fill="#0A84FF" stroke="transparent" strokeWidth={0} x={13.3} y={50.8} w={1.35} h={2.4} radius={16} />
  <Text id="timeline-build-title" x={28.6} y={38} w={18} h={7} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={22}>Build</Text>
  <Text id="timeline-build-copy" x={28.6} y={57} w={18} h={13} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={16} lineHeight={1.2}>Programs launched and the first signals came in.</Text>
  <Shape id="timeline-build-dot" shape="circle" fill="#0A84FF" stroke="transparent" strokeWidth={0} x={35.3} y={50.8} w={1.35} h={2.4} radius={16} />
  <Text id="timeline-peak-title" x={50.6} y={38} w={18} h={7} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={22}>Peak</Text>
  <Text id="timeline-peak-copy" x={50.6} y={57} w={18} h={13} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={16} lineHeight={1.2}>Engagement and reach hit their high point.</Text>
  <Shape id="timeline-peak-dot" shape="circle" fill="#0A84FF" stroke="transparent" strokeWidth={0} x={57.3} y={50.8} w={1.35} h={2.4} radius={16} />
  <Text id="timeline-wrap-title" x={72.6} y={38} w={20} h={7} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={22}>Wrap-up</Text>
  <Text id="timeline-wrap-copy" x={72.6} y={57} w={20} h={13} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={16} lineHeight={1.2}>Results reviewed and shared with the team.</Text>
  <Shape id="timeline-wrap-dot" shape="circle" fill="#0A84FF" stroke="transparent" strokeWidth={0} x={79.3} y={50.8} w={1.35} h={2.4} radius={16} />
  <Shape id="timeline-sun" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={92.3} y={6.5} w={5} h={8.9} radius={16} />
</Slide>

<Slide duration={5} fontSizeUnit="pt" theme="dark" background="#0A2540" accent="#FFBC90" textColor="#FFFFFF" mutedColor="#B9CAD8" canvasHeight={1080} canvasWidth={1920} slideTransition="rise" transitionDuration={0.7}>
  <Text id="next-title" x={6.6} y={10} w={70} h={13} color="#FFFFFF" fontFamily="Arial" fontWeight={700} fontSize={60} lineHeight={1} enter="rise">What's Next</Text>
  <Shape id="next-rule" shape="line" fill="transparent" stroke="#315570" strokeWidth={1.2} x={6.6} y={33} w={64} h={0.3} radius={16} />
  <Shape id="next-one-dot" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={6.6} y={41.6} w={1.35} h={2.4} radius={16} />
  <Text id="next-one" x={10} y={40.5} w={74} h={7} color="#FFFFFF" fontFamily="Arial" fontWeight={400} fontSize={21} enter="fadeUp" delay={0.16}>Name an owner for every open item</Text>
  <Shape id="next-two-dot" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={6.6} y={54} w={1.35} h={2.4} radius={16} />
  <Text id="next-two" x={10} y={52.5} w={74} h={7} color="#FFFFFF" fontFamily="Arial" fontWeight={400} fontSize={21} enter="fadeUp" delay={0.26}>Lock the plan for next season's kickoff</Text>
  <Shape id="next-three-dot" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={6.6} y={66} w={1.35} h={2.4} radius={16} />
  <Text id="next-three" x={10} y={64.5} w={74} h={7} color="#FFFFFF" fontFamily="Arial" fontWeight={400} fontSize={21} enter="fadeUp" delay={0.36}>Share the recap with the wider team</Text>
  <Shape id="next-four-dot" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={6.6} y={78} w={1.35} h={2.4} radius={16} />
  <Text id="next-four" x={10} y={76.5} w={82} h={7} color="#FFFFFF" fontFamily="Arial" fontWeight={400} fontSize={21} enter="fadeUp" delay={0.46}>Turn this season's wins into next season's baseline</Text>
</Slide>

<Slide duration={5} fontSizeUnit="pt" theme="light" background="#38BDF8" accent="#0A84FF" textColor="#FFFFFF" mutedColor="#DFF6FF" canvasHeight={1080} canvasWidth={1920} slideTransition="fade" transitionDuration={0.7} shader="mesh-gradient" shaderEngine="three" shaderPreset="Beach" shaderFrame={20512} shaderSpeed={0} shaderScale={1} shaderIntensity={0.8} shaderSoftness={0.35} shaderDetail={0} shaderAngle={0} shaderColor1="#BCECF6" shaderColor2="#00AAFF" shaderColor3="#00F7FF" shaderColor4="#FFD447" shaderColor5="#BCECF6" shaderColor6="#FFFFFF">
  <Text id="thanks-kicker" x={7} y={11} w={58} h={6} color="#6366f1" fontFamily="Arial" fontWeight={700} fontSize={15} letterSpacing={0.5} enter="fadeIn">QUESTIONS | FEEDBACK | NEXT SEASON</Text>
  <Text id="thanks-title" x={7} y={54.5} w={56} h={15} fontFamily="Arial" fontWeight={700} fontSize={72} lineHeight={1} enter="rise" delay={0.12} color="#6366f1">Thank You</Text>
  <Text id="thanks-caption" x={7} y={76} w={60.2} h={7} fontFamily="Arial" fontWeight={400} fontSize={18} lineHeight={1.2} enter="fadeUp" delay={0.24} color="#6366f1">Let's carry the strongest signals into the season ahead.</Text>
</Slide>`;

const publicSummerTimeReportSources = {
  en: summerTimeReportSource,
  "zh-TW": summerTimeReportSource
} as const;

const priorMotionTemplateSources = new Map<string, Record<"en" | "zh-TW", string>>(
  motionTemplates.map((template) => [
    template.id,
    {
      en: localTemplateSource(template.sources.en),
      "zh-TW": localTemplateSource(template.sources["zh-TW"])
    }
  ])
);

export function getBundledTemplateLibrarySource(templateId: string, locale: "zh-TW" | "en") {
  if (templateId === "summer-time-report") return publicSummerTimeReportSources[locale];
  return priorMotionTemplateSources.get(templateId)?.[locale];
}

export function getBundledTemplateLibraryBlankSource(templateId: string, locale: "zh-TW" | "en") {
  const source = getBundledTemplateLibrarySource(templateId, locale);
  const firstSlide = source ? motionDocSlideSourceRanges(source)[0] : undefined;
  const tagName = firstSlide?.source.match(/^<(Slide|Scene)\b/)?.[1];
  const openingTag = firstSlide?.openingTag.replace(/\s+slideTransition="morph"/, ' slideTransition="none"');
  return openingTag && tagName ? `# Untitled\n\n${openingTag}\n</${tagName}>` : undefined;
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

function localTemplateSource(source: string) {
  return stripNonLocalMotionDocMedia(materializeFreeformSource(source));
}
