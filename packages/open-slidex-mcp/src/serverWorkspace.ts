import { resolve } from "node:path";
import { readdir, stat } from "node:fs/promises";

import {
  resolveExistingInsideRoot,
  SlideXFileDocumentAdapter
} from "@open-slidex/sdk/node";

export class OpenSlideXWorkspaceMcpScope {
  private selectedPresentationId?: string;
  readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = resolve(workspaceRoot);
  }

  async list() {
    const entries = await readdir(this.workspaceRoot, { withFileTypes: true }).catch((error: unknown) => {
      if (isNodeError(error) && error.code === "ENOENT") return [];
      throw error;
    });
    const described = await Promise.all(entries.flatMap((entry) => {
      if (!entry.isDirectory() || entry.name.startsWith(".") || !/^[A-Za-z0-9._-]+$/.test(entry.name)) return [];
      return [this.describe(entry.name)];
    }));
    const presentations = described.filter((value) => value !== undefined);
    presentations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    if (!this.selectedPresentationId && presentations[0]) this.selectedPresentationId = presentations[0].id;
    if (this.selectedPresentationId && !presentations.some((item) => item.id === this.selectedPresentationId)) {
      this.selectedPresentationId = presentations[0]?.id;
    }
    return { presentations, selectedPresentationId: this.selectedPresentationId, workspaceRoot: this.workspaceRoot };
  }

  async select(presentationId: string) {
    const snapshot = await this.list();
    const presentation = snapshot.presentations.find((item) => item.id === presentationId);
    if (!presentation) throw new Error(`Workspace presentation was not found: ${presentationId}`);
    this.selectedPresentationId = presentation.id;
    return { presentation, selectedPresentationId: presentation.id };
  }

  async selectedRoot() {
    const snapshot = await this.list();
    if (!snapshot.selectedPresentationId) {
      throw new Error("This OpenSlideX workspace has no presentations. Create or import one in Workspace first.");
    }
    return resolve(this.workspaceRoot, snapshot.selectedPresentationId);
  }

  private async describe(id: string) {
    const root = resolve(this.workspaceRoot, id);
    try {
      const adapter = await documentAdapterForRoot(root);
      const sourcePath = await resolveExistingInsideRoot(root, adapter.documentPath, "file");
      const sourceStats = await stat(sourcePath);
      const document = await adapter.open();
      const sourceFormat = sourcePath.endsWith(".tsx") ? "tsx" : "mdx";
      return { id, requiresMigration: sourceFormat === "mdx", root, sourceFormat, title: document.title, updatedAt: sourceStats.mtime.toISOString() };
    } catch {
      return undefined;
    }
  }
}

export async function documentAdapterForRoot(root: string) {
  const tsx = resolve(root, "presentation.tsx");
  const documentPath = await resolveExistingInsideRoot(root, tsx, "file").then(
    () => "presentation.tsx",
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "presentation.mdx";
      throw error;
    }
  );
  return new SlideXFileDocumentAdapter({ documentPath, projectRoot: root });
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
