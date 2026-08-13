export const enDictionary = {
  metadata: {
    description: "Build clear presentations with a precise canvas, solid fills, and focused motion."
  },
  footer: {
    rights: "© 2026 SlideX. All rights reserved."
  },
  thumbnail: {
    fallbackLabel: "Preset",
    ariaLabel: (title: string) => `${title} style thumbnail`,
    sceneLayers: "Slide layers",
    layers: ["Text", "Icon", "Table"],
    motionReady: "Motion ready"
  },
  marketing: {
    agent: {
      heroTitle: "Turn ideas into slides with an AI Agent",
      heroDescription: "Describe the deck you need. The Agent builds, edits, and organizes slides directly on the SlideX canvas.",
      getStarted: "Get started",
      learnHeddleAgent: "Learn about Heddle Agent",
      loginNow: "Log in now",
      workflowTitle: "From one request to a real deck",
      workflowBody: "Tell the Agent your goal. It creates, edits, and organizes the slides on the canvas.",
      challengeTitle: "More than a chat window",
      challengeParagraphs: [
        "SlideX already includes templates, a browser editor, MotionDoc tools, and PowerPoint export. The Agent must use those capabilities instead of stopping at a conversation.",
        "A reliable Agent remembers the request, shows clear progress, restores completed conversations, and works safely alongside manual edits."
      ],
      boundariesTitle: "How Heddle and SlideX work together",
      boundariesDescription: "Heddle provides reusable Agent capabilities. SlideX owns the users, presentation data, and product experience.",
      heddleProvides: "What Heddle handles",
      heddleItems: [
        "Multi-turn conversations and request context",
        "Model, tool, and MCP execution",
        "Runs, event order, replay, and cancellation",
        "Browser-safe remote protocols and reconnection",
        "Conflict-protected Session and Archive storage"
      ],
      slideXOwns: "What SlideX owns",
      slideXItems: [
        "Authentication, tenant scope, and presentation authorization",
        "MotionDoc and conflict-protected presentation writes",
        "Conversation history, retention policies, and the Supabase Adapter",
        "Editor interface, undo, and stale-result review",
        "Model credentials, deployments, and operational policies"
      ],
      ctaTitle: "Let the Agent start your next presentation",
      ctaStart: "Create your first presentation"
    }
  }
} as const;
