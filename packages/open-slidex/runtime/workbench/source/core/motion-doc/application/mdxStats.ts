export type MotionDocStats = {
  sceneCount: number;
  totalDuration: number;
};

export function getMotionDocStats(source: string): MotionDocStats {
  const sceneMatches = Array.from(
    source.matchAll(/<(?:Slide|Scene)\b[^>]*duration=\{?([0-9.]+)\}?[^>]*>/g)
  );

  return {
    sceneCount: sceneMatches.length,
    totalDuration: sceneMatches.reduce((total, match) => {
      const duration = Number.parseFloat(match[1] ?? "0");
      return Number.isFinite(duration) ? total + duration : total;
    }, 0)
  };
}
