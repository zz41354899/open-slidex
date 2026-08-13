import type { RemoteMcpOperation } from "@/features/pitch/domain/remoteMcpOperation";

const runningLifetimeMs = 10 * 60_000;
const settledLifetimeMs = 6_000;

export function remoteMcpOperationDeadline(activity: RemoteMcpOperation) {
  const timestamp = activity.status === "running"
    ? activity.createdAt
    : activity.completedAt ?? activity.updatedAt;
  return new Date(timestamp).getTime()
    + (activity.status === "running" ? runningLifetimeMs : settledLifetimeMs);
}

export function remoteMcpOperationAction(
  activity: Pick<RemoteMcpOperation, "errorCode" | "status" | "toolName">,
  locale: "en" | "zh-TW"
) {
  if (activity.status === "failed") {
    if (activity.errorCode === "revision_conflict") {
      return locale === "zh-TW" ? "版本衝突，未覆蓋內容" : "Revision conflict; nothing overwritten";
    }
    return locale === "zh-TW" ? "操作未完成" : "Operation not completed";
  }

  const action = remoteToolAction(activity.toolName, locale);
  if (activity.status === "completed") {
    return locale === "zh-TW" ? `${action}完成` : `${action} complete`;
  }
  return action;
}

export function remoteMcpOperationTargetsSlide(
  activity: RemoteMcpOperation,
  slideIndex: number,
  activeSlideIndex: number
) {
  if (activity.target.kind === "presentation") return slideIndex === activeSlideIndex;
  return activity.target.slideIndex === slideIndex;
}

function remoteToolAction(toolName: string, locale: "en" | "zh-TW") {
  const actions: Record<string, [string, string]> = {
    slidex_add_block: ["Adding an object", "新增物件"],
    slidex_add_slide_from_layout: ["Adding a slide", "新增投影片"],
    slidex_apply_shader_preset: ["Applying a shader", "套用 Shader"],
    slidex_delete_block: ["Deleting an object", "刪除物件"],
    slidex_duplicate_block: ["Duplicating an object", "複製物件"],
    slidex_finalize_presentation_image_upload: ["Finalizing an image", "完成圖片上傳"],
    slidex_prepare_presentation_image_upload: ["Preparing an image", "準備圖片上傳"],
    slidex_reorder_block: ["Reordering objects", "調整物件順序"],
    slidex_replace_slide_with_layout: ["Applying a layout", "套用版面"],
    slidex_save_presentation: ["Saving the presentation", "儲存整份簡報"],
    slidex_update_block: ["Editing an object", "修改物件"],
    slidex_update_canvas_node: ["Moving an object", "調整物件位置"]
  };
  return actions[toolName]?.[locale === "zh-TW" ? 1 : 0]
    ?? (locale === "zh-TW" ? "修改簡報" : "Editing presentation");
}
