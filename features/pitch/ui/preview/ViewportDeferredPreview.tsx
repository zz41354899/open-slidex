import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

type ViewportDeferredPreviewProps = {
  children: ReactNode;
  eager?: boolean;
  rootMargin?: string;
  rootRef?: RefObject<Element | null>;
};

/**
 * Keeps the slide shell mounted for stable scrolling and selection, while
 * releasing expensive media/WebGL content when it is well outside the
 * viewport. The generous margin mounts previews before they become visible.
 */
export function ViewportDeferredPreview({
  children,
  eager = false,
  rootMargin = "480px 0px",
  rootRef
}: ViewportDeferredPreviewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(eager);

  useEffect(() => {
    if (eager) {
      setShouldRender(true);
      return;
    }

    const frame = frameRef.current;
    if (!frame || !("IntersectionObserver" in window)) {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setShouldRender(Boolean(entry?.isIntersecting)),
      { root: rootRef?.current ?? null, rootMargin }
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [eager, rootMargin, rootRef]);

  return (
    <div
      className="absolute inset-0"
      data-viewport-preview-rendered={shouldRender ? "true" : "false"}
      ref={frameRef}
    >
      {shouldRender ? children : null}
    </div>
  );
}
