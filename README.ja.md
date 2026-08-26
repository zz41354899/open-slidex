# OpenSlideX

[English](README.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

OpenSlideX は、編集可能なプレゼンテーションのための、オープンソースかつローカルファーストのワークスペースです。各プレゼンテーションは所有者のフォルダに保存され、`presentation.mdx` が唯一のソースになります。

アカウント、バックグラウンド同期、隠れたクラウド依存なしで、デッキの作成、編集、プレビュー、エクスポートができます。MotionDoc 形式は可搬性と可読性を保ち、使い慣れたツールや Git のワークフローで編集を続けられます。

## Workspace デモを見る

<video src="https://www.slidexdeck.com/marketing/open-slidex/slidex.mp4" poster="https://www.slidexdeck.com/marketing/open-slidex/slidex-poster.webp" controls muted playsinline width="100%">
  <a href="https://www.slidexdeck.com/marketing/open-slidex/slidex.mp4">OpenSlideX Workspace デモを見る</a>
</video>

README ビューアが埋め込み動画に対応していない場合は、[OpenSlideX Workspace デモを開いてください](https://www.slidexdeck.com/marketing/open-slidex/slidex.mp4)。

## Node.js や Git を使わないインストール

スタンドアロンインストーラーは、専用の Node.js 実行ファイルと Chromium renderer を含む OpenSlideX ランタイム一式をダウンロードします。npm、Git、システム全体の Node.js はインストールせず、管理者権限も不要です。

macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/zz41354899/open-slidex/main/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/zz41354899/open-slidex/main/install.ps1 | iex
```

初回インストール後は新しいターミナルを開き、次を実行します。

```bash
slidex             # ローカル Workspace を開く
slidex update      # 最新版を確認してインストールする
slidex uninstall   # ランタイムとコマンドを削除し、プレゼンテーションは残す
```

既定のライブラリは、macOS では `~/Documents/OpenSlideX Workspace`、Windows では現在のユーザーの Documents フォルダです。ダウンロードする release archive は SHA-256 checksum で検証されます。

## 開発者向けクイックスタート

OpenSlideX には Node.js 22.12 以降が必要です。

```bash
git clone https://github.com/zz41354899/open-slidex.git
cd open-slidex
npm install
npm run dev
```

これでローカル Workspace が起動します。空のデッキとテンプレートベースのデッキは既定で gitignore 対象の `open-slidex-workspace/` に作成され、それぞれに `presentation.mdx` があります。アカウントや Supabase プロジェクトは不要です。同梱テンプレートは **Summer Time Report** と **Moodboard** です。

### 別の Workspace フォルダまたはポートを使う

```bash
npm run dev -- ~/Presentations --port 4174
```

## npm で独立したデッキを作成する

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

インストール済みプロジェクトの `npm run dev` は常に `/workspace` を開き、プロジェクト内の `open-slidex-workspace/` をルートにします。各デッキは自身のソース、アセット、エクスポートを所有し、Workbench ソースと依存キャッシュは `.open-slidex/` に保存されます。

Starter には、PPTX ソースインポート、MDX 作成、ナラティブ設計、モーション設計、視覚 QA のプロジェクトローカル Agent Skill が 5 つ含まれます。詳しい手順と native-layer 例は各 skill の `references/` にあります。

## ローカルでできること

- 空のデッキまたは公式テンプレートから開始する。
- ローカル Workbench で native MotionDoc MDX を編集する。
- Vite HMR でプレビュー、検証、render、export を行う。
- 対応する agent client 向けに Workspace スコープの MCP を設定する。

Workspace Settings は Codex、Claude Code、Claude Desktop 用のユーザーレベル MCP 設定を生成できます。MCP には 6 つのツールがあります。ワークスペース選択、段階的なソース／リソース読込（browser-native HTML を含む）、PPTX ソースインポート、メディア、レビュー、編集です。`open_slidex_read` は canonical HTML bytes を保持してオンライン依存を報告し、`open_slidex_edit` は revision 保護付きで HTML を作成または置換します。HTTP(S) リソースは opaque-origin sandbox で実行されます。

## Repository コマンド

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | ローカル Workspace を開く。 |
| `npm run mcp` | `open-slidex-workspace/` 用の MCP を起動する。 |
| `npm run build:runtime` | 配布 runtime を再構築する。 |
| `npm run build:standalone` | 現在のプラットフォーム向け standalone archive を作成する。 |
| `npm run test:standalone` | installer、install、update、launch、uninstall を検証する。 |
| `npm run test:source` | SDK、Workbench、MCP、CLI、Workspace の tests を実行する。 |

## プロジェクト境界とライセンス

OpenSlideX は非公開の SlideX Cloud 製品とは独立しています。この repository にはローカル editor、Workbench、MCP runtime、filesystem-safe SDK、CLI、starter project、examples、contributor tooling が含まれます。Cloud routes、アカウント、認証、Supabase clients、リモートプレゼンテーション保存、credentials、Cloud-only Premium templates は含まれません。

MIT。詳しくは [LICENSE](LICENSE) を参照してください。
