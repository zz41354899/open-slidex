"use client";

import { PitchWorkspace } from "@/features/pitch/ui/PitchWorkspace";
import type { PitchWorkspaceProps } from "@/features/pitch/ui/workspace/PitchWorkspaceTypes";

/**
 * The single storage-neutral editor surface used by both Cloud Pitch and the
 * filesystem-backed OpenSlideX Workbench. Persistence belongs to the caller.
 */
export function MotionDocEditor(props: PitchWorkspaceProps) {
  return <PitchWorkspace {...props} />;
}
