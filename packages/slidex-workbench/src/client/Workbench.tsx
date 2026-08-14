import { lazy, Suspense } from "react";

const EditorWorkbench = lazy(() => import("./EditorWorkbench"));
const WorkspaceHome = lazy(() => import("./WorkspaceHome").then(({ WorkspaceHome: component }) => ({ default: component })));

export function Workbench() {
  const workspaceRoute = window.location.pathname === "/workspace" || window.location.pathname === "/workspace/";
  return (
    <Suspense fallback={<WorkbenchLoading workspaceRoute={workspaceRoute} />}>
      {workspaceRoute ? <WorkspaceHome /> : <EditorWorkbench />}
    </Suspense>
  );
}

function WorkbenchLoading({ workspaceRoute }: { workspaceRoute: boolean }) {
  return (
    <main className="flex h-[100dvh] items-center justify-center bg-black text-sm text-neutral-500">
      {workspaceRoute ? "Opening Workspace…" : "Opening presentation.mdx…"}
    </main>
  );
}
