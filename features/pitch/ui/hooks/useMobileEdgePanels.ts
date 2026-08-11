"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";

type UseMobileEdgePanelsArgs = {
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  setIsLeftPanelOpen: Dispatch<SetStateAction<boolean>>;
  setIsRightPanelOpen: Dispatch<SetStateAction<boolean>>;
};

type EdgeGesture = {
  mode: "close-left" | "close-right" | "open-left" | "open-right";
  pointerId: number;
  startX: number;
  startY: number;
  triggered: boolean;
};

const mobileBreakpoint = 768;
const edgeActivationWidth = 28;
const gestureDistance = 58;

export function useMobileEdgePanels({
  isLeftPanelOpen,
  isRightPanelOpen,
  setIsLeftPanelOpen,
  setIsRightPanelOpen
}: UseMobileEdgePanelsArgs) {
  useEffect(() => {
    let gesture: EdgeGesture | null = null;
    const activeTouchPointers = new Set<number>();

    function handlePointerDown(event: PointerEvent) {
      if (event.pointerType !== "touch" || window.innerWidth >= mobileBreakpoint) {
        return;
      }

      activeTouchPointers.add(event.pointerId);

      if (activeTouchPointers.size > 1) {
        gesture = null;
        return;
      }

      const mode = gestureModeFromStart(event.clientX, window.innerWidth, isLeftPanelOpen, isRightPanelOpen);

      if (!mode) {
        return;
      }

      gesture = {
        mode,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        triggered: false
      };
    }

    function handlePointerMove(event: PointerEvent) {
      if (!gesture || gesture.pointerId !== event.pointerId || gesture.triggered) {
        return;
      }

      const deltaX = event.clientX - gesture.startX;
      const deltaY = event.clientY - gesture.startY;

      if (Math.abs(deltaY) > Math.abs(deltaX) * 0.8) {
        return;
      }

      if (!gestureReachedThreshold(gesture.mode, deltaX)) {
        return;
      }

      gesture.triggered = true;
      applyGesture(gesture.mode, setIsLeftPanelOpen, setIsRightPanelOpen);
    }

    function clearGesture(event: PointerEvent) {
      activeTouchPointers.delete(event.pointerId);
      if (gesture?.pointerId === event.pointerId) {
        gesture = null;
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", clearGesture);
    window.addEventListener("pointercancel", clearGesture);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", clearGesture);
      window.removeEventListener("pointercancel", clearGesture);
    };
  }, [isLeftPanelOpen, isRightPanelOpen, setIsLeftPanelOpen, setIsRightPanelOpen]);
}

function gestureModeFromStart(
  x: number,
  viewportWidth: number,
  isLeftPanelOpen: boolean,
  isRightPanelOpen: boolean
): EdgeGesture["mode"] | null {
  if (isLeftPanelOpen) return "close-left";
  if (isRightPanelOpen) return "close-right";
  if (x <= edgeActivationWidth) return "open-left";
  if (x >= viewportWidth - edgeActivationWidth) return "open-right";
  return null;
}

function gestureReachedThreshold(mode: EdgeGesture["mode"], deltaX: number) {
  if (mode === "open-left" || mode === "close-right") return deltaX >= gestureDistance;
  return deltaX <= -gestureDistance;
}

function applyGesture(
  mode: EdgeGesture["mode"],
  setIsLeftPanelOpen: Dispatch<SetStateAction<boolean>>,
  setIsRightPanelOpen: Dispatch<SetStateAction<boolean>>
) {
  if (mode === "open-left") {
    setIsRightPanelOpen(false);
    setIsLeftPanelOpen(true);
    return;
  }

  if (mode === "open-right") {
    setIsLeftPanelOpen(false);
    setIsRightPanelOpen(true);
    return;
  }

  if (mode === "close-left") setIsLeftPanelOpen(false);
  if (mode === "close-right") setIsRightPanelOpen(false);
}
