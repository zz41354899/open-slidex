import { slidexIconNames, type SlideXIconName } from "@/core/motion-doc/domain/lucideIconRegistry";

export const iconCategoryIds = ["all", "recent", "popular", "business", "data", "people", "creative", "interface"] as const;

export type IconCategoryId = (typeof iconCategoryIds)[number];

export const iconCategoryLabels: Record<IconCategoryId, string> = {
  all: "All",
  recent: "Recent",
  popular: "Popular",
  business: "Business",
  data: "Data",
  people: "People",
  creative: "Creative",
  interface: "Interface"
};

const iconGroups = {
  popular: ["Sparkles", "CheckCircle", "ArrowUpRight", "Target", "TrendingUp", "Star", "Lightbulb", "Rocket"],
  business: ["BriefcaseBusiness", "Presentation", "Megaphone", "Target", "Trophy", "Award", "BadgeCheck", "Calendar", "Clock", "Globe"],
  data: ["BarChart3", "ChartNoAxesCombined", "PieChart", "LineChart", "TrendingUp", "Database", "ScanSearch"],
  people: ["Users", "UserCheck", "MessageSquare", "Mail", "Heart", "MapPin"],
  creative: ["Sparkles", "Palette", "PenTool", "Image", "Lightbulb", "Gem", "Star", "Layers", "LayoutTemplate"],
  interface: ["MousePointer2", "Search", "Link", "Download", "Upload", "FileText", "Code2", "Terminal", "Cloud", "Lock", "KeyRound", "Settings", "SlidersHorizontal", "Info", "CircleAlert"]
} as const satisfies Record<Exclude<IconCategoryId, "all" | "recent">, readonly SlideXIconName[]>;

const iconSearchAliases: Partial<Record<SlideXIconName, readonly string[]>> = {
  ArrowUpRight: ["growth", "external", "direction"],
  BadgeCheck: ["verified", "approved", "success"],
  BarChart3: ["analytics", "comparison", "metrics"],
  BriefcaseBusiness: ["work", "company", "job"],
  CheckCircle: ["done", "success", "complete"],
  CircleAlert: ["warning", "risk", "error"],
  Lightbulb: ["idea", "insight"],
  LineChart: ["trend", "analytics", "growth"],
  MapPin: ["location", "place"],
  Megaphone: ["marketing", "announcement"],
  MessageSquare: ["chat", "comment", "conversation"],
  Palette: ["design", "color", "brand"],
  Presentation: ["slides", "pitch", "deck"],
  Rocket: ["launch", "startup", "speed"],
  ScanSearch: ["inspect", "discover", "research"],
  ShieldCheck: ["security", "safe", "protected"],
  Sparkles: ["ai", "magic", "new"],
  Target: ["goal", "focus", "objective"],
  Users: ["team", "group", "audience"]
};

export function iconsForCategory(category: IconCategoryId, recent: readonly SlideXIconName[]) {
  if (category === "all") return slidexIconNames;
  if (category === "recent") return recent;
  return iconGroups[category];
}

export function iconMatchesQuery(name: SlideXIconName, label: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [name, label, ...(iconSearchAliases[name] ?? [])]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}
