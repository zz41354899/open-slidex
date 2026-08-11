"use client";

import { useCallback, type MutableRefObject, type PointerEvent, type RefObject } from "react";
import {
  updateTableColumnTrackValues,
  updateTableRowTrackValues,
  type TableSelection
} from "@/core/motion-doc/application/tableBlock";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { resizeTableTrackPair, tableTrackTotal } from "@/features/pitch/application/tableTrackGeometry";

type UseTableTrackResizeOptions = {
  columnTracks: number[];
  frameRef: RefObject<HTMLDivElement | null>;
  latestPropsRef: MutableRefObject<MotionDocProps>;
  rowTracks: number[];
  selectTablePart: (selection: TableSelection) => void;
  updateTableProps: (props: MotionDocProps, transient?: boolean) => void;
};

export function useTableTrackResize({
  columnTracks,
  frameRef,
  latestPropsRef,
  rowTracks,
  selectTablePart,
  updateTableProps
}: UseTableTrackResizeOptions) {
  return useCallback((currentSelection: TableSelection, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    selectTablePart(currentSelection);

    const rect = frameRef.current?.getBoundingClientRect();
    const isColumn = currentSelection.kind === "column";
    const startTracks = isColumn ? columnTracks : rowTracks;
    const axisSize = isColumn ? rect?.width : rect?.height;
    const neighborIndex = currentSelection.index < startTracks.length - 1
      ? currentSelection.index + 1
      : currentSelection.index - 1;

    if (!axisSize || axisSize <= 0 || neighborIndex < 0) return;

    const handleElement = event.currentTarget;
    handleElement.setPointerCapture(event.pointerId);
    const pointerId = event.pointerId;
    const startPosition = isColumn ? event.clientX : event.clientY;
    const totalTrack = tableTrackTotal(startTracks);

    function nextPropsForPosition(clientPosition: number) {
      const deltaUnits = ((clientPosition - startPosition) / axisSize!) * totalTrack;
      const nextTracks = resizeTableTrackPair(startTracks, currentSelection.index, neighborIndex, deltaUnits);
      return isColumn
        ? updateTableColumnTrackValues(latestPropsRef.current, nextTracks)
        : updateTableRowTrackValues(latestPropsRef.current, nextTracks);
    }

    function handlePointerMove(moveEvent: globalThis.PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      updateTableProps(nextPropsForPosition(isColumn ? moveEvent.clientX : moveEvent.clientY), true);
    }

    function handlePointerUp(upEvent: globalThis.PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      upEvent.preventDefault();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      if (handleElement.hasPointerCapture(pointerId)) handleElement.releasePointerCapture(pointerId);
      updateTableProps(nextPropsForPosition(isColumn ? upEvent.clientX : upEvent.clientY), false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }, [columnTracks, frameRef, latestPropsRef, rowTracks, selectTablePart, updateTableProps]);
}
