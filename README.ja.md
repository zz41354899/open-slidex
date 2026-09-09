# OpenSlideX

[English](README.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

OpenSlideX は、編集可能なプレゼンテーションのための、オープンソースかつローカルファーストのワークスペースです。各プレゼンテーションは所有者のフォルダに保存され、`presentation.tsx` が唯一の編集ソースになります。MDX は互換インポートとポータブルなエクスポート用に維持されます。

アカウント、バックグラウンド同期、隠れたクラウド依存なしで、デッキの作成、編集、プレビュー、エクスポートができます。MotionDoc 形式は可搬性と可読性を保ち、使い慣れたツールや Git のワークフローで編集を続けられます。

## Workspace デモを見る

[![OpenSlideX Workspace デモ — クリックして再生](https://www.slidexdeck.com/marketing/open-slidex/slidex-poster.webp)](https://www.slidexdeck.com/marketing/open-slidex/slidex.mp4)

プレビューをクリックすると、[OpenSlideX Workspace デモを再生できます](https://www.slidexdeck.com/marketing/open-slidex/slidex.mp4)。

## インストール

`npx`、`pnpm`、Yarn、または Bun でプロジェクトを作成できます。npx、pnpm、Yarn のコマンドには Node.js 22.12 以降が必要です。Bun は自身の最新ランタイムを使用します。Node.js 不要のスタンドアロンインストールは macOS のみ対応です。

### npx（すべてのプラットフォーム）

```bash
npx open-slidex@latest init my-deck
cd my-deck
npm run dev
```

### pnpm

```bash
pnpm dlx open-slidex@latest init my-deck
cd my-deck
pnpm dev
```

### Yarn（2+）

```bash
yarn dlx open-slidex@latest init my-deck
cd my-deck
yarn dev
```

### Bun

```bash
bunx open-slidex@latest init my-deck
cd my-deck
bun run dev
```

### macOS スタンドアロン

macOS インストーラーは、専用の Node.js 実行ファイルと Chromium renderer を含む OpenSlideX ランタイム一式をダウンロードします。npm、Git、システム全体の Node.js はインストールしません。

macOS:

```bash
curl -fLO https://github.com/zz41354899/open-slidex/releases/latest/download/install.sh
gh attestation verify install.sh --repo zz41354899/open-slidex
sh install.sh
```

初回インストール後は新しいターミナルを開き、次を実行します。

```bash
slidex             # ローカル Workspace を開く
slidex update      # 最新版を確認してインストールする
slidex rollback    # 保持している直前の正常バージョンへ戻す
slidex uninstall   # ランタイムとコマンドを削除し、プレゼンテーションは残す
```

既定のライブラリは macOS では `~/Documents/OpenSlideX Workspace` です。ダウンロードする release archive は SHA-256 checksum と GitHub artifact attestation で検証され、attestation に紐付く SPDX SBOM とオフライン provenance bundle を含みます。macOS では `gh` をあらかじめ利用可能にしてください。

## 開発者向けクイックスタート

OpenSlideX には Node.js 22.12 以降が必要です。

```bash
git clone https://github.com/zz41354899/open-slidex.git
cd open-slidex
npm install
npm run dev
```

これでローカル Workspace が起動します。空のデッキとテンプレートベースのデッキは既定で gitignore 対象の `open-slidex-workspace/` に作成され、それぞれに `presentation.tsx` があります。アカウントや Supabase プロジェクトは不要です。同梱テンプレートは **Summer Time Report** と **Moodboard** です。

### 別の Workspace フォルダまたはポートを使う

```bash
npm run dev -- ~/Presentations --port 4174
```

## パッケージランナー CLI

```bash
npx open-slidex@latest init my-deck
cd my-deck
npm run dev
```

または CLI をグローバルにインストールします。

```bash
npm install --global open-slidex@latest
open-slidex init my-deck
```

`npx` の代わりに `pnpm dlx`、`yarn dlx`、または `bunx` を使えます。作成したプロジェクトでは、それぞれ `pnpm dev`、`yarn dev`、`bun run dev` を実行します。

インストール済みプロジェクトの `npm run dev` は常に `/workspace` を開き、プロジェクト内の `open-slidex-workspace/` をルートにします。各デッキは自身のソース、アセット、エクスポートを所有し、Workbench ソースと依存キャッシュは `.open-slidex/` に保存されます。

Starter には、PPTX ソースインポート、MDX 作成、ナラティブ設計、モーション設計、視覚 QA のプロジェクトローカル Agent Skill が 5 つ含まれます。詳しい手順と native-layer 例は各 skill の `references/` にあります。

## ローカルでできること

- 空のデッキまたは公式テンプレートから開始する。
- ローカル Workbench で native MotionDoc MDX を編集する。
- Vite HMR でプレビュー、検証、render、export を行う。
- 対応する agent client 向けに Workspace スコープの MCP を設定する。

Workspace Settings は Codex、Claude Code、Claude Desktop 用のユーザーレベル MCP 設定を生成できます。MCP には 6 つのツールがあります。ワークスペース選択、段階的なソース／リソース読込（browser-native HTML を含む）、PPTX ソースインポート、メディア、レビュー、編集です。`open_slidex_read` は canonical HTML bytes を保持して検出したネットワーク依存を報告し、`open_slidex_edit` は revision 保護付きで HTML を作成または置換します。インポートした HTML はオフラインの opaque-origin サムネイル sandbox で静的プレビューとしてのみ描画され、リモートリソース、絶対パス、`file:` URL、symlink sidecar は拒否されます。

## Repository コマンド

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | ローカル Workspace を開く。 |
| `npm run mcp` | `open-slidex-workspace/` 用の MCP を起動する。 |
| `npm run build:runtime` | 配布 runtime を再構築する。 |
| `npm run build:standalone` | macOS 向けの完全な standalone archive を作成する。 |
| `npm run test:standalone` | macOS installer、install、update、launch、uninstall を検証する。 |
| `npm run test:source` | SDK、Workbench、MCP、CLI、Workspace の tests を実行する。 |

## プロジェクト境界とライセンス

OpenSlideX は非公開の SlideX Cloud 製品とは独立しています。この repository にはローカル editor、Workbench、MCP runtime、filesystem-safe SDK、CLI、starter project、examples、contributor tooling が含まれます。Cloud routes、アカウント、認証、Supabase clients、リモートプレゼンテーション保存、credentials、Cloud-only Premium templates は含まれません。

MIT。詳しくは [LICENSE](LICENSE) を参照してください。
