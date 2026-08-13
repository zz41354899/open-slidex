import type * as React from "react";

import { cn } from "@/packages/editor-ui/src/lib/utils";

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-1.5", className)} data-slot="field" {...props} />;
}

export { Field };
