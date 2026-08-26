export const openSlideXProjectSkillNames = [
  "slidex-source-import",
  "slidex-mdx-authoring",
  "slidex-html-authoring",
  "slidex-deck-design",
  "slidex-motion-direction",
  "slidex-deck-qa"
] as const;

export type OpenSlideXProjectSkillName = (typeof openSlideXProjectSkillNames)[number];

export const openSlideXGuidanceIntents = [
  "import",
  "authoring",
  "html",
  "design",
  "create",
  "redesign",
  "motion",
  "qa"
] as const;

export type OpenSlideXGuidanceIntent = (typeof openSlideXGuidanceIntents)[number];

export const openSlideXGuidanceSkillsByIntent = {
  authoring: ["slidex-mdx-authoring"],
  html: [
    "slidex-html-authoring",
    "slidex-deck-design",
    "slidex-motion-direction",
    "slidex-deck-qa"
  ],
  import: [
    "slidex-source-import",
    "slidex-mdx-authoring",
    "slidex-deck-design",
    "slidex-motion-direction",
    "slidex-deck-qa"
  ],
  create: [
    "slidex-mdx-authoring",
    "slidex-deck-design",
    "slidex-motion-direction",
    "slidex-deck-qa"
  ],
  design: ["slidex-mdx-authoring", "slidex-deck-design", "slidex-deck-qa"],
  motion: ["slidex-mdx-authoring", "slidex-motion-direction", "slidex-deck-qa"],
  qa: ["slidex-deck-qa"],
  redesign: [
    "slidex-mdx-authoring",
    "slidex-deck-design",
    "slidex-motion-direction",
    "slidex-deck-qa"
  ]
} as const satisfies Record<
  OpenSlideXGuidanceIntent,
  readonly OpenSlideXProjectSkillName[]
>;
