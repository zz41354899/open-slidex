export type EditorDocumentSnapshot = {
  revision: string;
  source: string;
  title: string;
};

export type EditorSelectionContext = {
  activeSlideIndex: number;
  primaryNodeId?: string;
  revision: string;
  selectedNodeIds: string[];
  updatedAt: string;
};

export type EditorExportRequest = {
  fileName: string;
  format: "html" | "mdx" | "pptx";
  source: string;
};

export type EditorExportResult = {
  output: string;
};

export type EditorRuntimeAdapter = {
  save(input: {
    expectedRevision: string;
    source: string;
    title: string;
  }): Promise<EditorDocumentSnapshot>;
  importAsset?(file: File, expectedRevision: string): Promise<{
    mimeType: string;
    name: string;
    source: string;
  }>;
  removeAsset?(source: string, expectedRevision: string): Promise<void>;
  export?(input: EditorExportRequest): Promise<EditorExportResult>;
  updateContext?(context: EditorSelectionContext): Promise<void>;
};

export type EditorCapabilities = {
  ai: boolean;
  charts: boolean;
  cloudComments: boolean;
  cloudTemplates: boolean;
  connectAi: boolean;
  localAssets: boolean;
  narrowScreenEditing: boolean;
  remoteMcpActivity: boolean;
};
