import { useEffect, useState } from "react";
import {
  Cable, Check, CheckCircle2, ClipboardCopy, HardDrive, Languages, ShieldCheck, Upload
} from "lucide-react";

import {
  readWorkspaceMcpSetup,
  type LocalWorkspaceSnapshot,
  type WorkspaceMcpClient,
  type WorkspaceMcpPlatform,
  type WorkspaceMcpSetup
} from "./api";

type Props = {
  locale: "en" | "zh-TW";
  onImport(): void;
  onLocale(value: "en" | "zh-TW"): void;
  workspace: LocalWorkspaceSnapshot;
};

export function WorkspaceSettingsView({ locale, onImport, onLocale, workspace }: Props) {
  const zh = locale === "zh-TW";
  const [mcpClient, setMcpClient] = useState<WorkspaceMcpClient>("codex");
  const [mcpPlatform, setMcpPlatform] = useState<WorkspaceMcpPlatform>(() => navigator.platform.toLowerCase().includes("win") ? "windows" : "macos");
  const [mcpSetup, setMcpSetup] = useState<WorkspaceMcpSetup>();
  const [mcpError, setMcpError] = useState("");
  const [copied, setCopied] = useState<"config" | "prompt">();
  const presentationScopedMcp = mcpSetup?.scopeType === "presentation";

  useEffect(() => {
    let active = true;
    setMcpError("");
    void readWorkspaceMcpSetup(mcpClient, mcpPlatform)
      .then((setup) => { if (active) setMcpSetup(setup); })
      .catch((error) => { if (active) setMcpError(messageOf(error, zh ? "無法產生 MCP 設定。" : "Could not generate the MCP setup.")); });
    return () => { active = false; };
  }, [mcpClient, mcpPlatform, zh]);

  async function copyMcp(value: string, target: "config" | "prompt") {
    await navigator.clipboard.writeText(value);
    setCopied(target);
    window.setTimeout(() => setCopied((current) => current === target ? undefined : current), 1600);
  }

  return (
    <div className="osx-settings-view">
      <section className="osx-settings-card is-overview"><span className="osx-settings-icon"><HardDrive size={20} /></span><div className="osx-settings-copy"><small>{zh ? "本機工作區" : "Local workspace"}</small><strong>{workspace.name}</strong><p>{zh ? "所有簡報都以獨立資料夾儲存在這個位置。" : "Every presentation is stored here in its own folder."}</p><code>{workspace.root}</code></div><em className="osx-settings-status"><i />{zh ? "本機可用" : "Available locally"}</em></section>
      <section className="osx-settings-card"><header><span className="osx-settings-icon"><Languages size={19} /></span><div><small>{zh ? "介面" : "Interface"}</small><strong>{zh ? "顯示語言" : "Display language"}</strong></div></header><p>{zh ? "切換 Workspace 的選單、提示與日期格式。" : "Change Workspace menus, prompts, and date formatting."}</p><div aria-label={zh ? "介面語言" : "Interface language"} className="osx-settings-segmented" role="group"><button className={locale === "zh-TW" ? "is-active" : ""} onClick={() => onLocale("zh-TW")} type="button">繁體中文</button><button className={locale === "en" ? "is-active" : ""} onClick={() => onLocale("en")} type="button">English</button></div></section>
      <section className="osx-settings-card"><header><span className="osx-settings-icon"><ShieldCheck size={19} /></span><div><small>{zh ? "資料與隱私" : "Data and privacy"}</small><strong>{zh ? "完全本機" : "Fully local"}</strong></div></header><p>{zh ? "不需要登入，不使用 Supabase，也沒有背景同步。" : "No login, Supabase, or background sync is used."}</p><ul><li><CheckCircle2 size={14} />{zh ? "簡報來源固定為 presentation.mdx" : "presentation.mdx remains the only source"}</li><li><CheckCircle2 size={14} />{zh ? "檔案只存在於你的裝置" : "Files stay on this device"}</li></ul></section>
      <section className="osx-settings-card is-mcp"><header><span className="osx-settings-icon"><Cable size={19} /></span><div><small>{zh ? "全域整合" : "Global integration"}</small><strong>{presentationScopedMcp ? (zh ? "簡報 MCP 伺服器" : "Presentation MCP Server") : (zh ? "工作區 MCP 伺服器" : "Workspace MCP Server")}</strong></div></header><p>{presentationScopedMcp ? (zh ? "不啟動或偵測任何 CLI。這份使用者層級設定只允許 Desktop Agent 讀寫目前安裝資料夾內的 presentation.mdx。" : "No CLI is launched or detected. This user-level configuration only allows desktop agents to work with presentation.mdx in this installed project folder.") : (zh ? "不啟動或偵測任何 CLI。這裡只產生一份使用者層級設定，讓 Desktop Agent 直接列出工作區簡報並讀寫各自的 presentation.mdx。" : "No CLI is launched or detected. This generates one user-level configuration so desktop agents can list workspace presentations and work directly with each presentation.mdx.")}</p><div className="osx-mcp-controls"><div aria-label={zh ? "MCP 用戶端" : "MCP client"} className="osx-settings-segmented is-three" role="group">{(["codex", "claude-code", "claude-desktop"] as const).map((client) => <button className={mcpClient === client ? "is-active" : ""} key={client} onClick={() => setMcpClient(client)} type="button">{client === "codex" ? "Codex" : client === "claude-code" ? "Claude Code" : "Claude Desktop"}</button>)}</div><div aria-label={zh ? "作業系統" : "Operating system"} className="osx-settings-segmented" role="group"><button className={mcpPlatform === "macos" ? "is-active" : ""} onClick={() => setMcpPlatform("macos")} type="button">macOS</button><button className={mcpPlatform === "windows" ? "is-active" : ""} onClick={() => setMcpPlatform("windows")} type="button">Windows</button></div></div>{mcpError ? <p className="osx-mcp-error">{mcpError}</p> : mcpSetup ? <><div className="osx-mcp-meta"><span>{zh ? "全域設定位置" : "Global config location"}<code>{mcpSetup.configPath}</code></span><span>{presentationScopedMcp ? (zh ? "簡報路徑" : "Presentation path") : (zh ? "工作區範圍" : "Workspace scope")}<code>{mcpSetup.presentationPath ?? mcpSetup.scopeRoot}</code></span></div><pre className="osx-mcp-config"><code>{mcpSetup.config}</code></pre><div className="osx-mcp-actions"><button onClick={() => void copyMcp(mcpSetup.config, "config")} type="button">{copied === "config" ? <Check size={14} /> : <ClipboardCopy size={14} />}{copied === "config" ? (zh ? "已複製" : "Copied") : (zh ? "複製設定" : "Copy config")}</button><button onClick={() => void copyMcp(mcpSetup.prompt, "prompt")} type="button">{copied === "prompt" ? <Check size={14} /> : <ClipboardCopy size={14} />}{copied === "prompt" ? (zh ? "已複製" : "Copied") : (zh ? "複製設定提示" : "Copy setup prompt")}</button></div></> : <p>{zh ? "正在產生設定…" : "Generating configuration…"}</p>}</section>
      <section className="osx-settings-card is-import"><span className="osx-settings-icon"><Upload size={20} /></span><div className="osx-settings-copy"><small>{zh ? "簡報匯入" : "Presentation import"}</small><strong>{zh ? "可攜式 MotionDoc MDX" : "Portable MotionDoc MDX"}</strong><p>{zh ? "新匯出的 MDX 會把圖片一起帶走，匯入時自動還原成 assets/*.webp；舊格式缺圖也不會阻止匯入。" : "New MDX exports carry images and restore them to assets/*.webp. Missing images in older files no longer block import."}</p></div><button onClick={onImport} type="button"><Upload size={15} />{zh ? "選擇匯入檔" : "Choose import file"}</button></section>
    </div>
  );
}

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
