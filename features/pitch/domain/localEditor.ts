import type {
  SlideXDocument,
  SlideXDocumentAdapter,
  SlideXRevision
} from "@/core/motion-doc/application/localSdk";

export type SlideXEditorContext = {
  activeSlideIndex: number;
  primaryNodeId?: string;
  revision: SlideXRevision;
  selectedNodeIds: string[];
  updatedAt: string;
};

export type SlideXEditorAsset = {
  mimeType: string;
  name: string;
  source: string;
};

export type SlideXEditorAssetAdapter = {
  import(file: File): Promise<SlideXEditorAsset>;
  remove?(source: string): Promise<void>;
};

export type SlideXEditorCloudAssetAdapter = {
  import(file: File, presentationId: string): Promise<{
    optimized: boolean;
    path: string;
    url: string;
  }>;
  isAuthenticationError(error: unknown): boolean;
  remove(path: string): Promise<void>;
};

export type SlideXEditorProps = {
  assetAdapter?: SlideXEditorAssetAdapter;
  document: SlideXDocument;
  onChange?: (document: SlideXDocument) => void;
  onContextChange?: (context: SlideXEditorContext) => Promise<void> | void;
  onSave: SlideXDocumentAdapter["save"];
  workspaceHomeHref?: string;
};
