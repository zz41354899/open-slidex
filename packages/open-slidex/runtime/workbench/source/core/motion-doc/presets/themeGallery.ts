export const documentThemeCategories = ["basic", "business", "education", "creative", "minimal"] as const;

export type DocumentThemeCategory = (typeof documentThemeCategories)[number];

export type DocumentThemePreview = {
  accent: string;
  background: string;
  muted: string;
  surface: string;
  text: string;
};

export type DocumentTheme = {
  accent: string;
  background: string;
  bodyPlaceholder: string;
  category: DocumentThemeCategory;
  description: string;
  id: string;
  mutedColor: string;
  name: string;
  preview: DocumentThemePreview;
  source: string;
  textAlign: "center" | "left";
  textColor: string;
  theme: "dark" | "light";
  titlePlaceholder: string;
};

export type BlankDocumentSourceConfig = {
  accent: string;
  background: string;
  bodyPlaceholder: string;
  bodyFrame?: MotionDocFrame;
  bodyFontSize?: number;
  mutedColor: string;
  lineHeight?: number;
  textAlign: "center" | "left";
  textColor: string;
  theme: "dark" | "light";
  titleFontSize?: number;
  titleFrame?: MotionDocFrame;
  titlePlaceholder: string;
  titleWeight?: number;
};

type DocumentThemeConfig = Omit<DocumentTheme, "preview" | "source"> & BlankDocumentSourceConfig & {
  preview?: Partial<DocumentThemePreview>;
};

const centerTitleFrame = { h: 15, w: 64, x: 18, y: 30 } satisfies MotionDocFrame;
const centerBodyFrame = { h: 16, w: 54, x: 23, y: 52 } satisfies MotionDocFrame;

export const documentThemes = [
  createDocumentTheme({
    id: "basic-white",
    name: "Basic White",
    category: "basic",
    theme: "light",
    background: "#FFFFFF",
    accent: "#0a84ff",
    textColor: "#111827",
    mutedColor: "#475569",
    textAlign: "left",
    titlePlaceholder: "Title",
    bodyPlaceholder: "Write a short paragraph to begin your story.",
    description: "A clean white canvas for starting with the fewest elements."
  }),
  createDocumentTheme({
    id: "basic-black",
    name: "Basic Black",
    category: "basic",
    theme: "dark",
    background: "#000000",
    accent: "#ffffff",
    textColor: "#f8fafc",
    mutedColor: "#a1a1aa",
    textAlign: "left",
    titlePlaceholder: "Title",
    bodyPlaceholder: "Write a short paragraph to begin your story.",
    description: "A dark canvas that keeps only the text hierarchy."
  }),
  createDocumentTheme({
    id: "quiet-center",
    name: "Centered Soft White",
    category: "basic",
    theme: "light",
    background: "#f8fafc",
    accent: "#111827",
    textColor: "#111827",
    mutedColor: "#64748b",
    textAlign: "center",
    titlePlaceholder: "Title",
    bodyPlaceholder: "Write a short paragraph to begin your story.",
    titleFrame: centerTitleFrame,
    bodyFrame: centerBodyFrame,
    description: "A centered soft-white layout for covers and concise talks."
  }),
  createDocumentTheme({
    id: "midnight-board",
    name: "Midnight Board",
    category: "business",
    theme: "dark",
    background: "#07111f",
    accent: "#72a7ff",
    textColor: "#f8fbff",
    mutedColor: "#a8bdd7",
    textAlign: "left",
    titlePlaceholder: "Title",
    bodyPlaceholder: "Write a concise paragraph for a leadership narrative.",
    description: "Built for operating reviews, strategy decks, and leadership meetings.",
    preview: { surface: "#0d1728" }
  }),
  createDocumentTheme({
    id: "graphite-meeting",
    name: "Graphite Meeting",
    category: "business",
    theme: "dark",
    background: "#101113",
    accent: "#d4d4d8",
    textColor: "#f5f5f5",
    mutedColor: "#a1a1aa",
    textAlign: "left",
    titlePlaceholder: "Title",
    bodyPlaceholder: "Write a concise paragraph for a leadership narrative.",
    description: "Restrained and sharp for formal business drafting.",
    preview: { surface: "#1a1b1f" }
  }),
  createDocumentTheme({
    id: "signal-white",
    name: "Signal White",
    category: "business",
    theme: "light",
    background: "#f8faff",
    accent: "#3157ff",
    textColor: "#111827",
    mutedColor: "#64748b",
    textAlign: "left",
    titlePlaceholder: "Title",
    bodyPlaceholder: "Write a concise paragraph for a leadership narrative.",
    description: "Cool white with a blue signal accent for clear decisions."
  }),
  createDocumentTheme({
    id: "lecture-blue",
    name: "Lecture Blue",
    category: "education",
    theme: "light",
    background: "#edf5ff",
    accent: "#1d4ed8",
    textColor: "#12213f",
    mutedColor: "#536780",
    textAlign: "left",
    titlePlaceholder: "Title",
    bodyPlaceholder: "Write one explanatory paragraph for the lesson.",
    description: "A soft blue base for lessons, teaching, and explanations."
  }),
  createDocumentTheme({
    id: "chalk-dark",
    name: "Chalk Dark",
    category: "education",
    theme: "dark",
    background: "#0a1512",
    accent: "#9fe8c1",
    textColor: "#f1fff7",
    mutedColor: "#9fb7aa",
    textAlign: "left",
    titlePlaceholder: "Title",
    bodyPlaceholder: "Write one explanatory paragraph for the lesson.",
    description: "A deep chalkboard tone for unpacking concepts."
  }),
  createDocumentTheme({
    id: "creator-cyan",
    name: "Creator Cyan",
    category: "creative",
    theme: "light",
    background: "#45c3ea",
    accent: "#075985",
    textColor: "#062439",
    mutedColor: "#164e63",
    textAlign: "left",
    titlePlaceholder: "Title",
    bodyPlaceholder: "Write a short paragraph with the creative direction.",
    description: "A bright cyan canvas for creator showcases and opening frames.",
    preview: { surface: "#7ddcff" }
  }),
  createDocumentTheme({
    id: "plum-pitch",
    name: "Plum Pitch",
    category: "creative",
    theme: "dark",
    background: "#170b24",
    accent: "#f0a6ca",
    textColor: "#fff7fb",
    mutedColor: "#c9a9bd",
    textAlign: "left",
    titlePlaceholder: "Title",
    bodyPlaceholder: "Write a short paragraph with the creative direction.",
    description: "Deep plum with a pink accent for brand concepts."
  }),
  createDocumentTheme({
    id: "paper-minimal",
    name: "Paper Minimal",
    category: "minimal",
    theme: "light",
    background: "#f4f4f5",
    accent: "#18181b",
    textColor: "#18181b",
    mutedColor: "#71717a",
    textAlign: "left",
    titlePlaceholder: "Title",
    bodyPlaceholder: "Write a quiet paragraph with only the essentials.",
    description: "A gray paper base with monochrome type and minimal visual noise."
  }),
  createDocumentTheme({
    id: "mono-black",
    name: "Mono Black",
    category: "minimal",
    theme: "dark",
    background: "#09090b",
    accent: "#e4e4e7",
    textColor: "#fafafa",
    mutedColor: "#a1a1aa",
    textAlign: "center",
    titlePlaceholder: "Title",
    bodyPlaceholder: "Write a quiet paragraph with only the essentials.",
    titleFrame: centerTitleFrame,
    bodyFrame: centerBodyFrame,
    description: "A centered black canvas for short, forceful openings."
  })
] satisfies readonly DocumentTheme[];

export const defaultDocumentTheme = documentThemes[0];
export const blankDocumentMdx = defaultDocumentTheme.source;

function createDocumentTheme(config: DocumentThemeConfig): DocumentTheme {
  const preview = {
    accent: config.accent,
    background: config.background,
    muted: config.mutedColor,
    surface: config.theme === "light" ? "#ffffff" : "#111111",
    text: config.textColor,
    ...config.preview
  } satisfies DocumentThemePreview;

  return {
    ...config,
    preview,
    source: createBlankDocumentSource(config)
  };
}

export function createBlankDocumentSource(config: BlankDocumentSourceConfig) {
  return `# Untitled

<Slide fontSizeUnit="pt" duration={5} theme="${config.theme}" background="${config.background}" accent="${config.accent}" textColor="${config.textColor}" mutedColor="${config.mutedColor}" alignX="${config.textAlign}" alignY="center" textAlign="${config.textAlign}">
</Slide>`;
}
import type { MotionDocFrame } from "@/core/motion-doc/domain/frame";
