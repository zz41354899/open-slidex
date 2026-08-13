import { useEffect, useMemo, useRef, useState } from "react";
import { buildMotionDocPreviewHtml, parseMotionDoc } from "@open-slidex/sdk";
import { Maximize2, X } from "lucide-react";

type PresenterProps = {
  initialSlide: number;
  onClose: () => void;
  source: string;
};

export function Presenter({ initialSlide, onClose, source }: PresenterProps) {
  const deck = useMemo(() => parseMotionDoc(source), [source]);
  const [slideIndex, setSlideIndex] = useState(initialSlide);
  const [seconds, setSeconds] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const html = useMemo(
    () =>
      buildMotionDocPreviewHtml(source, {
        assetBaseUrl: "/",
        cspNonce: "slidex-workbench-preview",
        parentOrigin: window.location.origin
      }),
    [source]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        setSlideIndex((value) => Math.min(value + 1, deck.scenes.length - 1));
      }
      if (event.key === "ArrowLeft") {
        setSlideIndex((value) => Math.max(value - 1, 0));
      }
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [deck.scenes.length, onClose]);

  function selectSlide() {
    const next = frameRef.current?.contentDocument?.querySelector<HTMLButtonElement>('[data-action="next"]');
    for (let index = 0; index < slideIndex; index += 1) next?.click();
  }

  const scene = deck.scenes[slideIndex];
  const nextScene = deck.scenes[slideIndex + 1];

  return (
    <section className="presenter" aria-label="Presenter view">
      <div className="presenter-toolbar">
        <strong>{deck.title}</strong>
        <span>{formatTime(seconds)}</span>
        <button onClick={() => void globalThis.document.documentElement.requestFullscreen()} type="button">
          <Maximize2 size={16} /> Fullscreen
        </button>
        <button onClick={onClose} type="button"><X size={17} /> Close</button>
      </div>
      <div className="presenter-grid">
        <div className="presenter-current">
          <iframe
            key={`${slideIndex}:${source}`}
            ref={frameRef}
            onLoad={selectSlide}
            sandbox="allow-scripts allow-same-origin allow-popups"
            srcDoc={html}
            title={`Current slide ${slideIndex + 1}`}
          />
        </div>
        <aside className="presenter-notes">
          <div>
            <span>Next</span>
            <strong>{nextScene ? sceneTitle(nextScene, slideIndex + 1) : "End of deck"}</strong>
          </div>
          <div>
            <span>Speaker notes</span>
            <pre>{scene?.notes?.plainText || "No notes for this slide."}</pre>
          </div>
          <div className="presenter-controls">
            <button onClick={() => setSlideIndex((value) => Math.max(value - 1, 0))} type="button">Previous</button>
            <span>{slideIndex + 1} / {deck.scenes.length}</span>
            <button onClick={() => setSlideIndex((value) => Math.min(value + 1, deck.scenes.length - 1))} type="button">Next</button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function sceneTitle(scene: ReturnType<typeof parseMotionDoc>["scenes"][number], index: number) {
  const text = scene.blocks.find((block) => "text" in block);
  return text && "text" in text ? text.text : `Slide ${index + 1}`;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
