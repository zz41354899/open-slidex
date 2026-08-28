# OpenSlideX

[English](README.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

OpenSlideX 是開源、local-first 的可編輯簡報工作區。每一份簡報都放在你擁有的資料夾中，並以 `presentation.mdx` 作為唯一的原始檔。

你可以在沒有帳號、背景同步或隱藏雲端依賴的情況下建立、編輯、預覽與匯出簡報。MotionDoc 格式保持可攜、可閱讀，並能使用你自己的工具與 Git 工作流程繼續編輯。

## 觀看 Workspace 示範

[![OpenSlideX Workspace 示範 — 點擊播放](https://www.slidexdeck.com/marketing/open-slidex/slidex-poster.webp)](https://www.slidexdeck.com/marketing/open-slidex/slidex.mp4)

點擊預覽圖即可[觀看 OpenSlideX Workspace 示範](https://www.slidexdeck.com/marketing/open-slidex/slidex.mp4)。

## 不需要 Node.js 或 Git 的安裝方式

獨立安裝程式會下載完整的 OpenSlideX 執行環境，包括私有的 Node.js 執行檔與 Chromium renderer；不會安裝 npm、Git 或系統層級的 Node.js，也不需要管理員權限。

macOS：

```bash
curl -fsSL https://raw.githubusercontent.com/zz41354899/open-slidex/main/install.sh | sh
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/zz41354899/open-slidex/main/install.ps1 | iex
```

首次安裝後請開啟新的終端機，再執行：

```bash
slidex             # 開啟本機 Workspace
slidex update      # 檢查並安裝最新版本
slidex uninstall   # 移除執行環境與指令，保留你的簡報
```

預設簡報庫在 macOS 為 `~/Documents/OpenSlideX Workspace`，Windows 則在目前使用者的 Documents 資料夾。每個下載的 release archive 都會先通過 SHA-256 checksum 驗證。

## 開發者快速開始

OpenSlideX 需要 Node.js 22.12 或更新版本。

```bash
git clone https://github.com/zz41354899/open-slidex.git
cd open-slidex
npm install
npm run dev
```

這會啟動本機 Workspace。空白或範本簡報預設會建立在被忽略的 `open-slidex-workspace/` 中，每個 deck 都有自己的 `presentation.mdx`；不需要帳號或 Supabase 專案。內建範本包括 **Summer Time Report** 與 **Moodboard**。

### 使用其他 Workspace 資料夾或連接埠

```bash
npm run dev -- ~/Presentations --port 4174
```

## 使用 npm 建立獨立 deck

```bash
npx open-slidex@latest init my-deck
cd my-deck
npm run dev
```

或全域安裝 CLI：

```bash
npm install --global open-slidex@latest
open-slidex init my-deck
```

已安裝專案中的 `npm run dev` 一律開啟 `/workspace`，根目錄是被忽略的 `open-slidex-workspace/`。每個 deck 都擁有自己的來源、資產與匯出檔；Workbench 原始碼與依賴快取保留在 `.open-slidex/`。

Starter 內含五項專案層級的 Agent Skills：PPTX 原始檔匯入、MDX 編寫、敘事設計、動態設計及視覺 QA。詳細指引與 native-layer 範例位於各個 skill 的 `references/` 目錄中。

## 可在本機完成的事

- 從空白簡報或官方範本開始。
- 在本機 Workbench 編輯 native MotionDoc MDX 簡報。
- 不使用影片式時間軸，也能組合精選的「開始、動作、結束」效果、文字數字區間，以及可柔化的形狀對形狀 Shared Morph。
- 可將任何 native 圖層設為安全的點擊區域，用來切換投影片或開啟連結；MDX 與匯出 HTML 保留相同行為。
- 透過 Vite HMR 預覽、驗證、render 與匯出本機檔案。
- 為支援的 agent client 設定選用的 Workspace 範圍 MCP 存取。

Workspace Settings 可以為 Codex、Claude Code 或 Claude Desktop 產生使用者層級 MCP 設定。MCP 有六個工具：工作區選取、漸進式原始檔／資源讀取（包含瀏覽器原生 HTML）、PPTX 原始檔匯入、媒體、審查與編輯。`open_slidex_read` 會保存 canonical HTML 位元組並報告線上依賴；`open_slidex_edit` 會透過 revision 保護建立或取代 HTML。HTTP(S) 資源會在 opaque-origin sandbox 中執行。

## Repository 指令

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 開啟本機 Workspace。 |
| `npm run mcp` | 為 `open-slidex-workspace/` 啟動 MCP。 |
| `npm run build:runtime` | 重建發行 runtime。 |
| `npm run build:standalone` | 建立目前平台的完整 standalone archive。 |
| `npm run test:standalone` | 驗證 installer、安裝、更新、啟動與解除安裝。 |
| `npm run test:source` | 執行 SDK、Workbench、MCP、CLI 與 Workspace 的 tests。 |

## 專案邊界與授權

OpenSlideX 與私有的 SlideX Cloud 產品相互獨立。此 repository 包含本機 editor、Workbench、MCP runtime、filesystem-safe SDK、CLI、starter project、範例與 contributor tooling；不包含雲端路由、帳號、認證、Supabase client、遠端簡報儲存、credentials 或 Cloud-only Premium templates。

MIT。請見 [LICENSE](LICENSE)。
