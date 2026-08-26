import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

type ViewportDeferredPreviewProps = {
  children: ReactNode;
  eager?: boolean;
  renderWhenVisible?: boolean;
  rootMargin?: string;
  rootRef?: RefObject<Element | null>;
  suspended?: boolean;
};

/**
 * Keeps the slide shell mounted for stable scrolling and selection, while
 * releasing expensive media/WebGL content when it is well outside the
 * viewport. The generous margin mounts previews before they become visible.
 */
export function ViewportDeferredPreview({
  children,
  eager = false,
  renderWhenVisible = true,
  rootMargin = "480px 0px",
  rootRef,
  suspended = false
}: ViewportDeferredPreviewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(eager);

  useEffect(() => {
    if (suspended || !renderWhenVisible) {
      setShouldRender(false);
      return;
    }
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
  }, [eager, renderWhenVisible, rootMargin, rootRef, suspended]);

  const renderPreview = !suspended && (eager || (renderWhenVisible && shouldRender));

  return (
    <div
      className="absolute inset-0"
      data-viewport-preview-rendered={renderPreview ? "true" : "false"}
      ref={frameRef}
    >
      {renderPreview ? children : null}
    </div>
  );
}
