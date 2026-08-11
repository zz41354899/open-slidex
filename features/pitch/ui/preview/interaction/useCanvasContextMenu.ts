"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";

export type CanvasContextMenuState = {
  blockIndex: number | null;
  position: { x: number; y: number };
};

export function useCanvasContextMenu() {
  const [contextMenu, setContextMenu] = useState<CanvasContextMenuState | null>(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const openContextMenu = useCallback((event: MouseEvent<HTMLElement>, blockIndex: number | null) => {
    setContextMenu({ blockIndex, position: clampedMenuPosition(event) });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeContextMenu();
    }

    window.addEventListener("pointerdown", closeContextMenu);
    window.addEventListener("resize", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", closeContextMenu);
      window.removeEventListener("resize", closeContextMenu);
      window.removeEventListener("scroll", closeContextMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeContextMenu, contextMenu]);

  return { closeContextMenu, contextMenu, openContextMenu };
}

function clampedMenuPosition(event: MouseEvent<HTMLElement>) {
  const menuWidth = 224;
  const menuHeight = 388;
  const margin = 12;

  return {
    x: Math.max(margin, Math.min(event.clientX, window.innerWidth - menuWidth - margin)),
    y: Math.max(margin, Math.min(event.clientY, window.innerHeight - menuHeight - margin))
  };
}
