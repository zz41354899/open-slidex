"use client";

import { useEffect, useState } from "react";

const imageCache = new Map<string, HTMLImageElement | Promise<HTMLImageElement>>();

export function useCachedShaderImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement | undefined>(() => cachedImage(src));

  useEffect(() => {
    if (!src) {
      setImage(undefined);
      return;
    }

    const cached = imageCache.get(src);

    if (isHtmlImage(cached)) {
      setImage(cached);
      return;
    }

    let isCurrent = true;
    const imagePromise = cached ?? loadShaderImage(src);
    imageCache.set(src, imagePromise);
    setImage(undefined);

    imagePromise
      .then((nextImage) => {
        imageCache.set(src, nextImage);

        if (isCurrent) {
          setImage(nextImage);
        }
      })
      .catch(() => {
        if (imageCache.get(src) === imagePromise) {
          imageCache.delete(src);
        }

        if (isCurrent) {
          setImage(undefined);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [src]);

  return image;
}

function cachedImage(src: string) {
  if (!src) {
    return undefined;
  }

  const cached = imageCache.get(src);

  return isHtmlImage(cached) ? cached : undefined;
}

function loadShaderImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    if (isExternalUrl(src)) {
      image.crossOrigin = "anonymous";
    }

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load shader image: ${src}`));
    image.src = src;
  });
}

function isHtmlImage(value: unknown): value is HTMLImageElement {
  return typeof HTMLImageElement !== "undefined" && value instanceof HTMLImageElement;
}

function isExternalUrl(value: string) {
  try {
    if (value.startsWith("/") || value.startsWith("data:") || value.startsWith("blob:")) {
      return false;
    }

    return new URL(value, window.location.origin).origin !== window.location.origin;
  } catch {
    return false;
  }
}
