export const openSlideXProjectSkillNames = [
  "slidex-source-import",
  "slidex-react-authoring",
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
  authoring: ["slidex-react-authoring"],
  html: [
    "slidex-html-authoring",
    "slidex-deck-design",
    "slidex-motion-direction",
    "slidex-deck-qa"
  ],
  import: [
    "slidex-source-import",
    "slidex-react-authoring",
    "slidex-deck-design",
    "slidex-motion-direction",
    "slidex-deck-qa"
  ],
  create: [
    "slidex-react-authoring",
    "slidex-deck-design",
    "slidex-motion-direction",
    "slidex-deck-qa"
  ],
  design: ["slidex-react-authoring", "slidex-deck-design", "slidex-deck-qa"],
  motion: ["slidex-react-authoring", "slidex-motion-direction", "slidex-deck-qa"],
  qa: ["slidex-deck-qa"],
  redesign: [
    "slidex-react-authoring",
    "slidex-deck-design",
    "slidex-motion-direction",
    "slidex-deck-qa"
  ]
} as const satisfies Record<
  OpenSlideXGuidanceIntent,
  readonly OpenSlideXProjectSkillName[]
>;
