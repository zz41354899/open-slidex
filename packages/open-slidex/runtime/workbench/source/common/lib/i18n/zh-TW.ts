export const zhTwDictionary = {
  metadata: {
    description: "用精確畫布、單色 Fill 與克制動態製作清楚的簡報。"
  },
  footer: {
    rights: "© 2026 SlideX. All rights reserved."
  },
  thumbnail: {
    fallbackLabel: "範本",
    ariaLabel: (title: string) => `${title} 風格縮圖`,
    sceneLayers: "投影片圖層",
    layers: ["文字", "圖示", "圖表"],
    motionReady: "動態就緒"
  },
  marketing: {
    agent: {
      heroTitle: "用 AI\u00A0Agent 將想法變成投影片",
      heroDescription: "說出你要完成的簡報，Agent 會直接在 SlideX 畫布裡建立、修改和整理投影片。",
      getStarted: "立即開始",
      learnHeddleAgent: "了解 Heddle Agent",
      loginNow: "馬上登入",
      workflowTitle: "從一句需求到一份簡報",
      workflowBody: "告訴 Agent 你的目標，它會直接在畫布裡建立、修改和整理投影片。",
      challengeTitle: "不只是聊天視窗",
      challengeParagraphs: [
        "SlideX 已有簡報範本、瀏覽器編輯器、MotionDoc 工具和 PowerPoint 匯出。Agent 必須真的使用這些能力，而不是停在對話視窗裡。",
        "可靠的體驗要能記住需求、清楚顯示進度、還原完成的對話，並安全地和手動編輯共存。"
      ],
      boundariesTitle: "Heddle 與 SlideX 的分工",
      boundariesDescription: "Heddle 提供可重用的 Agent 能力。SlideX 負責使用者、簡報資料和產品體驗。",
      heddleProvides: "Heddle 處理的事",
      heddleItems: [
        "多輪對話與需求脈絡整理",
        "模型、工具與 MCP 的執行流程",
        "Run、事件順序、重播和取消",
        "瀏覽器安全的遠端協定與重新連線",
        "具版本衝突保護的 Session 與 Archive"
      ],
      slideXOwns: "SlideX 負責的事",
      slideXItems: [
        "身分驗證、租戶範圍與簡報授權",
        "MotionDoc 與具衝突保護的簡報寫入",
        "對話紀錄、保留政策與 Supabase Adapter",
        "編輯器介面、復原與過期結果檢視",
        "模型憑證、部署與營運政策"
      ],
      ctaTitle: "讓 Agent 開始幫你做簡報",
      ctaStart: "建立第一份簡報"
    }
  }
} as const;
