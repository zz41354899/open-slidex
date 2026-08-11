export type RemoteMcpOperation = {
  clientId: string;
  clientName: string;
  completedAt?: string;
  completedRevision?: number;
  createdAt: string;
  errorCode?: string;
  expiresAt: string;
  id: string;
  presentationId: string;
  status: "running" | "completed" | "failed";
  target:
    | { kind: "presentation" }
    | { kind: "slide"; slideIndex: number }
    | { kind: "block"; nodeId: string; slideIndex: number };
  toolName: string;
  updatedAt: string;
};
