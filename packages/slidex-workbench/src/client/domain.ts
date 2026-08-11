import type { MotionDocBlock, MotionDocScene } from "@open-slidex/sdk";

export type ValidationIssue = {
  message: string;
  path?: string;
  severity: "error" | "warning";
};

export type ValidationResult = {
  isValid: boolean;
  issues: ValidationIssue[];
};

export type DocumentSnapshot = {
  projectId: string;
  revision: string;
  source: string;
  title: string;
  validation: ValidationResult;
};

export type SaveState =
  | "loading"
  | "saved"
  | "dirty"
  | "saving"
  | "invalid"
  | "conflict"
  | "error";

export type WorkbenchMode = "preview" | "source" | "assets";

export type Selection = {
  /** Presentation-only label for the Scope-first composer; server routes ignore it. */
  blockLabel?: string;
  blockIndex?: number;
  nodeId?: string;
  slideIndex: number;
};

export type AssetItem = {
  bytes: number;
  name: string;
  source: string;
  usedBy: Array<{ blockIndex?: number; prop: string; slideIndex: number }>;
};

export type StoredDraft = {
  baseRevision: string;
  source: string;
  updatedAt: string;
};

export type SelectedBlock = {
  block: MotionDocBlock;
  blockIndex: number;
  scene: MotionDocScene;
  slideIndex: number;
};
