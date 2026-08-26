# OpenSlideX

[English](README.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

OpenSlideX 是开源、local-first 的可编辑演示文稿工作区。每份演示文稿都存放在你拥有的文件夹中，并以 `presentation.mdx` 作为唯一源文件。

无需账号、后台同步或隐藏的云端依赖，即可创建、编辑、预览和导出演示文稿。MotionDoc 格式保持便携和易读，并能继续使用你自己的工具和 Git 工作流编辑。

## 观看 Workspace 演示

<video src="https://www.slidexdeck.com/marketing/open-slidex/slidex.mp4" poster="https://www.slidexdeck.com/marketing/open-slidex/slidex-poster.webp" controls muted playsinline width="100%">
  <a href="https://www.slidexdeck.com/marketing/open-slidex/slidex.mp4">观看 OpenSlideX Workspace 演示</a>
</video>

如果当前 README 阅读器不支持嵌入视频，请[打开 OpenSlideX Workspace 演示](https://www.slidexdeck.com/marketing/open-slidex/slidex.mp4)。

## 无需 Node.js 或 Git 的安装方式

独立安装程序会下载完整 OpenSlideX runtime，包括私有 Node.js 可执行文件和 Chromium renderer；不会安装 npm、Git 或系统级 Node.js，也无需管理员权限。

macOS：

```bash
curl -fsSL https://raw.githubusercontent.com/zz41354899/open-slidex/main/install.sh | sh
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/zz41354899/open-slidex/main/install.ps1 | iex
```

首次安装后，请打开新终端并执行：

```bash
slidex             # 打开本地 Workspace
slidex update      # 检查并安装最新版本
slidex uninstall   # 移除 runtime 和命令，保留你的演示文稿
```

macOS 的默认演示文稿库为 `~/Documents/OpenSlideX Workspace`；Windows 则位于当前用户的 Documents 文件夹。每个下载的 release archive 都会先通过 SHA-256 checksum 验证。

## 开发者快速开始

OpenSlideX 需要 Node.js 22.12 或更高版本。

```bash
git clone https://github.com/zz41354899/open-slidex.git
cd open-slidex
npm install
npm run dev
```

这会启动本地 Workspace。空白和模板演示文稿默认创建在已忽略的 `open-slidex-workspace/` 中，每个 deck 都有自己的 `presentation.mdx`；不需要账号或 Supabase 项目。内置模板包括 **Summer Time Report** 和 **Moodboard**。

### 使用其他 Workspace 文件夹或端口

```bash
npm run dev -- ~/Presentations --port 4174
```

## 使用 npm 创建独立 deck

```bash
npx open-slidex@latest init my-deck
cd my-deck
npm run dev
```

或者全局安装 CLI：

```bash
npm install --global open-slidex@latest
open-slidex init my-deck
```

已安装项目中的 `npm run dev` 会始终打开 `/workspace`，根目录是 `open-slidex-workspace/`。每个 deck 都拥有自己的源文件、资源和导出文件；Workbench 源文件和依赖缓存保留在 `.open-slidex/`。

Starter 包含五项项目级 Agent Skills：PPTX 源文件导入、MDX 编写、叙事设计、动效设计和视觉 QA。详细指引和 native-layer 示例位于每项 skill 的 `references/` 目录。

## 可在本地完成的事

- 从空白演示文稿或官方模板开始。
- 在本地 Workbench 编辑 native MotionDoc MDX 演示文稿。
- 通过 Vite HMR 预览、验证、render 和导出本地文件。
- 为支持的 agent client 配置可选的 Workspace 范围 MCP 访问。

Workspace Settings 可以为 Codex、Claude Code 或 Claude Desktop 生成用户级 MCP 配置。MCP 有六个工具：工作区选择、渐进式源文件／资源读取（包括浏览器原生 HTML）、PPTX 源文件导入、媒体、审查和编辑。`open_slidex_read` 会保留 canonical HTML bytes 并报告在线依赖；`open_slidex_edit` 会通过 revision 保护创建或替换 HTML。HTTP(S) 资源均在 opaque-origin sandbox 中运行。

## Repository 命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 打开本地 Workspace。 |
| `npm run mcp` | 为 `open-slidex-workspace/` 启动 MCP。 |
| `npm run build:runtime` | 重建发布 runtime。 |
| `npm run build:standalone` | 构建当前平台的 standalone archive。 |
| `npm run test:standalone` | 验证 installer、安装、更新、启动和卸载。 |
| `npm run test:source` | 运行 SDK、Workbench、MCP、CLI 和 Workspace 的 tests。 |

## 项目边界和许可证

OpenSlideX 与私有 SlideX Cloud 产品相互独立。此 repository 包含本地 editor、Workbench、MCP runtime、filesystem-safe SDK、CLI、starter project、示例和 contributor tooling；不包含 Cloud routes、账号、认证、Supabase clients、远程演示文稿存储、credentials 或 Cloud-only Premium templates。

MIT。请参阅 [LICENSE](LICENSE)。
