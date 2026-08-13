
import { useState } from "react";
import { Check, Clock3, History } from "lucide-react";
import type { SlideComment } from "@/features/pitch/application/slideComments";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type SlideCommentHistoryProps = {
  comments: SlideComment[];
  compact?: boolean;
  onPassComment: (commentId: string) => void;
};

export function SlideCommentHistory({ comments, compact = false, onPassComment }: SlideCommentHistoryProps) {
  const { locale, tx } = usePitchI18n();
  const [passingId, setPassingId] = useState<string | null>(null);

  if (comments.length === 0) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.018] px-5 text-center">
        <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/[0.045] text-neutral-500"><History size={16} /></span>
        <p className="text-xs font-semibold text-neutral-300">{tx("No open comments")}</p>
        <p className="mt-1 text-[11px] text-neutral-600">{tx("Leave the first note for this slide.")}</p>
      </div>
    );
  }

  function passComment(commentId: string) {
    if (passingId) return;
    setPassingId(commentId);
    window.setTimeout(() => {
      onPassComment(commentId);
      setPassingId(null);
    }, 480);
  }

  return (
    <ol className={`space-y-2.5 ${compact ? "max-h-48" : "max-h-[46dvh]"} overflow-y-auto pr-1`}>
      {[...comments].reverse().map((comment) => {
        const isPassing = passingId === comment.id;

        return (
          <li
            className={`rounded-2xl border p-3.5 transition duration-300 ${
              isPassing
                ? "scale-[0.98] border-emerald-400/35 bg-emerald-400/10 opacity-90"
                : "border-white/[0.07] bg-black/20"
            }`}
            key={comment.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#9ad7ff]/15 bg-[#9ad7ff]/10 text-[11px] font-bold text-[#bfe8ff]">
                  {authorInitial(comment.authorName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-neutral-200">{comment.authorName}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-neutral-500">
                    <Clock3 size={10} />
                    {formatCommentTimestamp(comment.createdAt, locale)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-full bg-white/[0.045] px-2 py-1 font-mono text-[10px] text-neutral-500">v{comment.version}</span>
                <button
                  aria-label={locale === "zh-TW" ? `通過留言 v${comment.version}` : `Pass comment v${comment.version}`}
                  className={`flex h-8 min-w-[3.75rem] items-center justify-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold transition active:scale-95 ${
                    isPassing
                      ? "border-emerald-300/45 bg-emerald-400 text-emerald-950"
                      : "border-white/[0.09] bg-white/[0.035] text-neutral-300 hover:border-emerald-400/30 hover:text-emerald-300"
                  }`}
                  disabled={Boolean(passingId)}
                  onClick={() => passComment(comment.id)}
                  type="button"
                >
                  {isPassing ? <Check className="animate-[bubble-appear_0.32s_ease-out]" size={15} strokeWidth={3} /> : null}
                  {tx(isPassing ? "Done" : "Pass")}
                </button>
              </div>
            </div>
            <p className="mt-3.5 whitespace-pre-wrap break-words text-[13px] leading-5 text-neutral-300">{comment.body}</p>
          </li>
        );
      })}
    </ol>
  );
}

function authorInitial(authorName: string) {
  return authorName.trim().charAt(0).toUpperCase() || "?";
}

function formatCommentTimestamp(createdAt: string | null, locale: "en" | "zh-TW") {
  if (!createdAt) return locale === "zh-TW" ? "較早的留言 · 日期無法取得" : "Earlier note · date unavailable";

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return locale === "zh-TW" ? "日期無法取得" : "Date unavailable";

  return new Intl.DateTimeFormat(locale === "zh-TW" ? "zh-TW" : "en", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}
