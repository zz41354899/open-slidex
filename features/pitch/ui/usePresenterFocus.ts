import { useEffect, type RefObject } from "react";

export function usePresenterFocus(root: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    if (!active || !root.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = root.current;
    element.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const scope = element.querySelector<HTMLElement>('[role="dialog"]') ?? element;
      const targets = Array.from(scope.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], textarea, input, select, [tabindex="0"]')).filter(item => item.getClientRects().length);
      const first = targets[0], last = targets.at(-1);
      if (!first || !last) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !targets.includes(document.activeElement as HTMLElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !targets.includes(document.activeElement as HTMLElement))) {
        event.preventDefault(); first.focus();
      }
    };
    element.addEventListener("keydown", trap);
    return () => { element.removeEventListener("keydown", trap); previous?.focus(); };
  }, [active, root]);
}
