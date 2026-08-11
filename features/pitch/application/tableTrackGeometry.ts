export function selectedTableTrackGeometry(tracks: readonly number[], index: number) {
  const total = tracks.reduce((sum, value) => sum + Math.max(value, 0), 0) || 1;
  const offset = tracks.slice(0, index).reduce((sum, value) => sum + Math.max(value, 0), 0);
  const size = Math.max(tracks[index] ?? 0, 0);

  return {
    offset: (offset / total) * 100,
    size: (size / total) * 100
  };
}

export function tableTrackTotal(tracks: readonly number[]) {
  return tracks.reduce((sum, value) => sum + Math.max(value, 0), 0) || 1;
}

export function resizeTableTrackPair(
  tracks: readonly number[],
  index: number,
  neighborIndex: number,
  deltaUnits: number
) {
  const minTrack = 0.28;
  const nextTracks = [...tracks];
  const current = Math.max(nextTracks[index] ?? 1, minTrack);
  const neighbor = Math.max(nextTracks[neighborIndex] ?? 1, minTrack);
  const minDelta = minTrack - current;
  const maxDelta = neighbor - minTrack;
  const clampedDelta = Math.min(Math.max(deltaUnits, minDelta), maxDelta);

  nextTracks[index] = current + clampedDelta;
  nextTracks[neighborIndex] = neighbor - clampedDelta;
  return nextTracks;
}
