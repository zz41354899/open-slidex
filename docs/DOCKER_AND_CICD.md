# OpenSlideX 容器化與 CI/CD 指南

本文件說明如何使用 Docker 執行 OpenSlideX，以及如何在 GitHub 上設定與驗證 CI/CD 工作流程。

---

## 目錄

1. [Docker 容器化指南](#一docker-容器化指南)
   - [快速啟動 (Docker Compose)](#1-快速啟動-docker-compose-推薦)
   - [手動建置與執行 (Docker CLI)](#2-手動建置與執行-docker-cli)
   - [環境變數與目錄掛載說明](#3-環境變數與目錄掛載說明)
2. [CI/CD 自動化流程](#二cicd-自動化流程)
   - [持續整合 (CI Pipeline)](#1-持續整合-ci-pipeline)
   - [Docker 建置與發布 (CD Pipeline)](#2-docker-建置與發布-cd-pipeline)
   - [獨立發行版 (Standalone Release)](#3-獨立發行版-standalone-release)
3. [提交 PR 前的驗證步驟](#三提交-pr-前的驗證步驟)

---

## 一、Docker 容器化指南

專案已提供包含無頭 Chromium、Noto CJK 字型與預先編譯 Runtime 的 `Dockerfile`。

### 1. 快速啟動 (Docker Compose 推薦)

```bash
# 建置並啟動容器
docker compose up -d

# 查看運行日誌
docker compose logs -f

# 停止並移除容器
docker compose down
```

啟動後，於瀏覽器開啟：<http://localhost:4172/workspace>

### 2. 手動建置與執行 (Docker CLI)

```bash
# 1. 建置 Image
docker build -t open-slidex:latest .

# 2. 執行 Container 並掛載本機 Workspace
docker run -d \
  --name open-slidex-workspace \
  -p 4172:4172 \
  -v "$(pwd)/open-slidex-workspace:/app/open-slidex-workspace" \
  open-slidex:latest
```

### 3. 環境變數與目錄掛載說明

- **服務埠 (Port)**：`4172`（OpenSlideX Workspace 預設監聽埠）

- **環境變數**：
  - `OPEN_SLIDEX_HOST=0.0.0.0`：允許容器外部連線。
  - `NODE_ENV=production`：以生產模式啟動。
  - `WORKSPACE_PATH`（可選）：覆寫 `docker-compose.yml` 中掛載到容器的本機簡報資料夾路徑，預設為 `./open-slidex-workspace`。

- **資料掛載 (Volume Mount)**：
  - 容器內路徑：`/app/open-slidex-workspace`
  - 建議掛載到本機資料夾，確保新增與編輯的簡報在容器重啟後仍會保留。

---

## 二、CI/CD 自動化流程

專案已在 `.github/workflows/` 設定以下自動化工作流程：

### 1. 持續整合 (CI Pipeline) — `.github/workflows/ci.yml`

- **觸發條件**：推送到 `main` 分支的 Push，或針對 `main` 分支的 Pull Request。

- **執行內容**：
  1. **Lint 與邊界檢查**：
     - 開源邊界檢查（`npm run check:open-source-boundary`）
     - Agent Skills 可發現性檢查（`npm run check:skills`）
     - TypeScript 型別檢查（`npx tsc --noEmit`）
  2. **多平台矩陣測試 (Matrix Test)**：
     - 作業系統：`ubuntu-latest`、`macos-latest`、`windows-latest`
     - Node.js 版本：`22`、`24`
     - 執行完整單元與整合測試（`npm run test:source`）

### 2. Docker 建置與發布 (CD Pipeline) — `.github/workflows/docker-publish.yml`

- **PR 驗證 (build-only)**：針對 `main` 分支的 Pull Request，僅建置 Docker image 以確認 `Dockerfile` 可正常建置，不會推送 image。

- **正式發布 (build-and-push)**：Push 到 `main` 分支，或發布 `v*` Tag，亦支援手動觸發（`workflow_dispatch`）。
  - 透過 QEMU 與 Docker Buildx 建置多架構映像檔（支援 `linux/amd64` 與 `linux/arm64`）。
  - 自動標記並發布到 **GitHub Container Registry (ghcr.io)**。
  - 使用者拉取映像檔範例：

    ```bash
    docker pull ghcr.io/<owner>/open-slidex:latest
    ```

### 3. 獨立發行版 (Standalone Release) — `.github/workflows/standalone-release.yml`

- **觸發條件**：推送版本 Tag（如 `v0.4.0`）。

- **執行內容**：
  - 自動編譯包含私有 Node.js 與 Chromium 的可攜式套件（支援 macOS ARM/Intel、Windows x64）。
  - 自動計算 SHA-256 Checksum 並建立 GitHub Release。

---

## 三、提交 PR 前的驗證步驟

### 1. 本機驗證測試

```bash
# 1. 型別檢查
npx tsc --noEmit

# 2. 執行所有原始碼測試
npm run test:source

# 3. 驗證 Runtime 建置
npm run build:runtime
```

### 2. Docker 本機驗證

```bash
# 建置並啟動 Docker
docker compose build
docker compose up -d

# 測試服務是否回應
curl -I http://localhost:4172/workspace
```

### 3. GitHub Actions 驗證

1. 將程式碼推送到 GitHub 遠端儲存庫的 feature branch。
2. 建立 Pull Request 至 `main` 分支，確認 GitHub Actions 的 **CI** 與 **Docker Publish（build-only）** 都能通過。
3. 合併至 `main` 後，確認 **Docker Publish** 自動建置並推送 GitHub Package。
