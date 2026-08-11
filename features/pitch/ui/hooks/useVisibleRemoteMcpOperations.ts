"use client";

import { useEffect, useMemo, useState } from "react";

import { remoteMcpOperationDeadline } from "@/features/pitch/application/remoteMcpOperation";
import type { RemoteMcpOperation } from "@/features/pitch/domain/remoteMcpOperation";

export function useVisibleRemoteMcpOperations(activities: readonly RemoteMcpOperation[]) {
  const [now, setNow] = useState(() => Date.now());
  const visible = useMemo(() => activities.filter((activity) => (
    remoteMcpOperationDeadline(activity) > now && new Date(activity.expiresAt).getTime() > now
  )), [activities, now]);

  useEffect(() => {
    const nextDeadline = visible.reduce(
      (earliest, activity) => Math.min(earliest, remoteMcpOperationDeadline(activity)),
      Number.POSITIVE_INFINITY
    );
    if (!Number.isFinite(nextDeadline)) return;
    const timeout = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(nextDeadline - Date.now() + 20, 20)
    );
    return () => window.clearTimeout(timeout);
  }, [visible]);

  return visible;
}
