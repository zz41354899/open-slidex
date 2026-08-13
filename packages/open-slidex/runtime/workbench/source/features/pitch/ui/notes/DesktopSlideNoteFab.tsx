
import { useEffect, useRef, useState } from "react";
import { MessageSquareText, Send, X } from "lucide-react";
import type { SlideComment } from "@/features/pitch/application/slideComments";
import { SlideCommentHistory } from "@/features/pitch/ui/notes/SlideCommentHistory";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type DesktopSlideNoteFabProps = {
  comments: SlideComment[];
  onAddComment: (comment: string) => void;
  onPassComment: (commentId: string) => void;
  slideNumber: number;
};

export function DesktopSlideNoteFab({
  comments,
  onAddComment,
  onPassComment,
  slideNumber
}: DesktopSlideNoteFabProps) {
  const { locale, tx } = usePitchI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function submitComment() {
    if (!draft.trim()) return;
    onAddComment(draft);
    setDraft("");
  }

  return (
    <div className="absolute bottom-6 right-5 z-40 hidden sm:block" ref={containerRef}>
      {isOpen ? (
        <section
          aria-label={locale === "zh-TW" ? `第 ${slideNumber} 張投影片的留言` : `Slide ${slideNumber} comments`}
          className="absolute bottom-16 right-0 w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#121316]/95 shadow-[0_24px_80px_rgba(0,0,0,0.68)] backdrop-blur-xl"
        >
          <header className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">{locale === "zh-TW" ? `第 ${slideNumber} 張投影片的留言` : `Slide ${slideNumber} comments`}</h2>
              <p className="mt-0.5 text-[11px] text-neutral-500">{locale === "zh-TW" ? `已儲存 ${comments.length} 個版本` : `${comments.length} saved version${comments.length === 1 ? "" : "s"}`}</p>
            </div>
            <button
              aria-label={tx("Close slide comments")}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-white/[0.08] hover:text-white"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <X size={17} />
            </button>
          </header>
          <div className="space-y-3 p-4">
            <SlideCommentHistory
              comments={comments}
              compact
              onPassComment={onPassComment}
            />
            <textarea
              autoFocus
              className="min-h-24 w-full resize-none rounded-xl border border-white/[0.1] bg-black/35 p-3 text-sm leading-6 text-white outline-none placeholder:text-neutral-600 focus:border-[#9ad7ff]/50"
              onChange={(event) => setDraft(event.target.value)}
              placeholder={tx("Add a new comment…")}
              value={draft}
            />
          </div>
          <footer className="flex items-center justify-between border-t border-white/[0.08] px-4 py-3">
            <span className="text-[11px] text-neutral-600">{tx("Posted as You")}</span>
            <button
              className="flex h-9 items-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-35"
              disabled={!draft.trim()}
              onClick={submitComment}
              type="button"
            >
              <Send size={14} />
              {tx("Post comment")}
            </button>
          </footer>
        </section>
      ) : null}

      <button
        aria-label={comments.length > 0
          ? (locale === "zh-TW" ? `查看投影片留言（${comments.length}）` : `View slide comments (${comments.length})`)
          : tx("Add slide comment")}
        aria-expanded={isOpen}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full border shadow-[0_16px_42px_rgba(0,0,0,0.58)] transition hover:-translate-y-0.5 active:translate-y-0 ${
          comments.length > 0
            ? "border-[#9ad7ff]/45 bg-[#9ad7ff] text-[#071017]"
            : "border-white/[0.14] bg-[#17181b] text-white hover:bg-[#202126]"
        }`}
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <MessageSquareText size={21} />
        {comments.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-black bg-white px-1 text-[10px] font-bold text-black">
            {Math.min(comments.length, 99)}
          </span>
        ) : null}
      </button>
    </div>
  );
}
