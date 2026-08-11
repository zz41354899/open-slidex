export function didPauseShader(previousSpeed: number, nextSpeed: number) {
  return previousSpeed !== 0 && nextSpeed === 0;
}

export function normalizeShaderFrame(frame: number) {
  if (!Number.isFinite(frame)) {
    return 0;
  }

  return Math.max(0, Math.round(frame));
}
