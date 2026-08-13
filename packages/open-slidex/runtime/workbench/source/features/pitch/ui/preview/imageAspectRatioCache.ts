const imageAspectRatios = new Map<string, number>();
const MAX_CACHED_IMAGE_ASPECT_RATIOS = 200;

export function cachedImageAspectRatio(source: string): number | null {
  const normalizedSource = source.trim();
  if (!normalizedSource) return null;

  return imageAspectRatios.get(normalizedSource) ?? null;
}

export function rememberImageAspectRatio(
  source: string,
  naturalWidth: number,
  naturalHeight: number
): number | null {
  const normalizedSource = source.trim();
  if (
    !normalizedSource
    || !Number.isFinite(naturalWidth)
    || !Number.isFinite(naturalHeight)
    || naturalWidth <= 0
    || naturalHeight <= 0
  ) {
    return null;
  }

  const aspectRatio = naturalWidth / naturalHeight;
  imageAspectRatios.delete(normalizedSource);
  imageAspectRatios.set(normalizedSource, aspectRatio);

  if (imageAspectRatios.size > MAX_CACHED_IMAGE_ASPECT_RATIOS) {
    const oldestSource = imageAspectRatios.keys().next().value;
    if (oldestSource) imageAspectRatios.delete(oldestSource);
  }

  return aspectRatio;
}
