import { useEffect, useState } from "react";
import { Cable, Check, ClipboardCopy, ExternalLink, LoaderCircle, MonitorCog, ShieldCheck, X } from "lucide-react";

import {
  installWorkspaceMcp,
  readWorkspaceMcpSetup,
  type WorkspaceMcpClient,
  type WorkspaceMcpPlatform,
  type WorkspaceMcpSetup
} from "./api";

type Props = {
  locale: "en" | "zh-TW";
  onClose(): void;
  onNotice(message: string): void;
};

const clients: readonly WorkspaceMcpClient[] = ["codex", "claude-code", "claude-desktop"];
const officialInstallUrls: Partial<Record<WorkspaceMcpClient, string>> = {
  "claude-code": "https://code.claude.com/docs/en/quickstart",
  "claude-desktop": "https://claude.com/download"
};

export function WorkspaceMcpDialog({ locale, onClose, onNotice }: Props) {
  const zh = locale === "zh-TW";
  const [client, setClient] = useState<WorkspaceMcpClient>("codex");
  const [platform, setPlatform] = useState<WorkspaceMcpPlatform>("macos");
  const [hostPlatform, setHostPlatform] = useState<WorkspaceMcpPlatform>(() =>
    typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent) ? "windows" : "macos"
  );
  const [scopeRootDraft, setScopeRootDraft] = useState("");
  const [scopeRoot, setScopeRoot] = useState<string>();
  const [setup, setSetup] = useState<WorkspaceMcpSetup>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState<"configuration" | "prompt">();

  useEffect(() => {
    let active = true;
    setError("");
    setSetup(undefined);
    if (platform !== hostPlatform && !scopeRoot) return () => { active = false; };
    void readWorkspaceMcpSetup(client, { platform, scopeRoot: platform === hostPlatform ? undefined : scopeRoot })
      .then((value) => {
        if (!active) return;
        setHostPlatform(value.hostPlatform);
        setSetup(value);
      })
      .catch((reason) => { if (active) setError(messageOf(reason, zh ? "無法準備 MCP 設定。" : "Could not prepare the MCP setup.")); });
    return () => { active = false; };
  }, [client, hostPlatform, platform, scopeRoot, zh]);

  function selectPlatform(value: WorkspaceMcpPlatform) {
    setPlatform(value);
    setCopied(undefined);
    setScopeRoot(undefined);
    setScopeRootDraft("");
  }

  async function copy(value: string, notice: string, kind: "configuration" | "prompt" = "configuration") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      onNotice(notice);
    } catch (reason) {
      setError(messageOf(reason, zh ? "無法複製設定。請在安全的本機連線後再試一次。" : "Could not copy the setup. Try again from a secure local connection."));
    }
  }

  async function install() {
    if (!setup) return;
    if (client === "claude-code") {
      const installedHere = setup.platform === setup.hostPlatform && setup.clientAvailable;
      await copy(
        installedHere ? setup.config : setup.prompt,
        installedHere
          ? (zh ? "Claude Code 指令已複製，貼到終端機後執行即可。" : "Claude Code command copied. Paste and run it in your terminal.")
          : (zh ? "Claude Code 安裝說明已複製。請先安裝 Claude Code，再執行設定指令。" : "Claude Code setup guidance copied. Install Claude Code before running the setup command."),
        installedHere ? "configuration" : "prompt"
      );
      return;
    }
    if (setup.platform !== setup.hostPlatform || !setup.clientAvailable) {
      await copy(setup.config, zh ? "所選平台的 MCP 設定已複製。" : "The selected platform's MCP configuration was copied.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await installWorkspaceMcp(client, setup.platform);
      onClose();
      const target = clientLabel(client);
      onNotice(zh
        ? `OpenSlideX MCP 已${result.action === "added" ? "安裝到" : "更新於"}${target}，重新啟動後即可使用。`
        : `OpenSlideX MCP ${result.action === "added" ? "installed in" : "updated for"} ${target}. Restart it to use the tools.`);
    } catch (reason) {
      if (statusOf(reason) === 404) {
        await copy(setup.config, zh ? "此 Workspace 尚未重啟至最新版；已改為複製設定。重啟後即可一鍵安裝。" : "This Workspace is still running an older server. The configuration was copied; restart it to enable one-click install.");
      } else {
        setError(messageOf(reason, zh ? "MCP 安裝失敗。" : "MCP installation failed."));
      }
    } finally {
      setPending(false);
    }
  }

  const scopeLabel = setup?.scopeType === "presentation"
    ? (zh ? "這份簡報" : "This presentation")
    : (zh ? "整個 Workspace" : "This Workspace");
  const canInstallHere = setup?.platform === setup?.hostPlatform && setup?.clientAvailable === true;
  const officialInstallUrl = !canInstallHere ? officialInstallUrls[client] : undefined;
  const primaryLabel = officialInstallUrl
    ? (zh ? `前往 ${clientLabel(client)} 官方安裝` : `Install ${clientLabel(client)}`)
    : client === "claude-code"
    ? !canInstallHere
      ? (zh ? "複製安裝說明" : "Copy setup guidance")
      : (zh ? "複製安裝指令" : "Copy install command")
    : !canInstallHere
      ? (zh ? "複製設定" : "Copy configuration")
    : (zh ? `安裝到 ${clientLabel(client)}` : `Install in ${clientLabel(client)}`);

  return (
    <div className="osx-workspace-overlay" onMouseDown={(event) => { if (event.button === 0 && !pending) onClose(); }} role="presentation">
      <section aria-labelledby="osx-mcp-title" aria-modal="true" className="osx-mcp-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <button aria-label={zh ? "關閉" : "Close"} className="osx-dialog-close" disabled={pending} onClick={onClose} type="button"><X size={17} /></button>
        <span className="osx-mcp-dialog-icon"><Cable size={20} /></span>
        <small>{zh ? "MCP 快速設定" : "MCP quick setup"}</small>
        <h2 id="osx-mcp-title">{zh ? "連接你的 AI 工作區" : "Connect your AI workspace"}</h2>
        <p>{zh ? "選擇 Agent 與平台分頁。若設定另一台裝置，請輸入該裝置的 Workspace 絕對路徑。" : "Choose an agent and platform. For another device, enter that device's absolute Workspace path."}</p>

        <div aria-label={zh ? "MCP 用戶端" : "MCP client"} className="osx-mcp-client-picker" role="group">
          {clients.map((value) => <button className={client === value ? "is-active" : ""} key={value} onClick={() => { setClient(value); setCopied(undefined); }} type="button">{clientLabel(value)}</button>)}
        </div>
        <div className="osx-mcp-platform-section">
          <span>{zh ? "設定平台" : "Setup platform"}</span>
          <div aria-label={zh ? "設定平台" : "Setup platform"} className="osx-mcp-platform-picker" role="group"><button className={platform === "macos" ? "is-active" : ""} onClick={() => selectPlatform("macos")} type="button">macOS</button><button className={platform === "windows" ? "is-active" : ""} onClick={() => selectPlatform("windows")} type="button">Windows</button></div>
        </div>

        {platform !== hostPlatform ? <form className="osx-mcp-scope-root" onSubmit={(event) => { event.preventDefault(); setScopeRoot(scopeRootDraft.trim() || undefined); }}>
          <label htmlFor="osx-mcp-scope-root">{zh ? `${platformName(platform)} 裝置上的 Workspace 絕對路徑` : `Absolute Workspace path on the ${platformName(platform)} device`}</label>
          <div><input autoComplete="off" id="osx-mcp-scope-root" onChange={(event) => setScopeRootDraft(event.target.value)} placeholder={platform === "windows" ? "C:\\Users\\you\\OpenSlideX Workspace" : "/Users/you/Documents/OpenSlideX Workspace"} spellCheck={false} value={scopeRootDraft} /><button disabled={!scopeRootDraft.trim()} type="submit">{scopeRoot ? (zh ? "更新設定" : "Update configuration") : (zh ? "產生設定" : "Generate configuration")}</button></div>
          <small>{zh ? "OpenSlideX 不會猜測或轉換另一個作業系統的本機路徑。" : "OpenSlideX never guesses or converts another operating system's local path."}</small>
        </form> : null}

        {error ? <div className="osx-workspace-error">{error}</div> : null}
        {!error && !setup && (platform === hostPlatform || scopeRoot) ? <div className="osx-mcp-loading"><LoaderCircle className="spin" size={15} />{zh ? "正在準備安全設定…" : "Preparing a safe setup…"}</div> : null}
        {setup ? <>
          <div className="osx-mcp-summary">
            <MonitorCog size={18} /><span><small>{zh ? "設定平台" : "Setup platform"}</small><strong>{platformName(setup.platform)}</strong></span><span><small>{scopeLabel}</small><strong>{setup.scopeRoot}</strong></span><span><small>{zh ? "設定位置" : "Configuration location"}</small><strong>{setup.configPath}</strong></span>
          </div>
          <div className="osx-mcp-privacy"><ShieldCheck size={15} /><span>{zh ? "不會啟動 CLI，也不會把你的設定內容傳到瀏覽器。" : "No CLI is started and your configuration contents never reach the browser."}</span></div>
          <details className="osx-mcp-details"><summary>{zh ? "檢視產生的設定" : "View generated configuration"}</summary><pre><code>{setup.config}</code></pre><button onClick={() => void copy(setup.config, zh ? "MCP 設定已複製。" : "MCP configuration copied.")} type="button">{copied === "configuration" ? <Check size={14} /> : <ClipboardCopy size={14} />}{zh ? "複製設定" : "Copy configuration"}</button></details>
          <details className="osx-mcp-details osx-mcp-prompt"><summary>{zh ? "複製平台安裝提示詞" : "Copy platform setup prompt"}</summary><p>{zh ? "提示詞會依目前選取的 macOS／Windows 分頁，帶入正確路徑、步驟與命令。" : "The prompt uses the selected macOS or Windows tab's correct paths, steps, and command."}</p><pre><code>{setup.prompt}</code></pre><button onClick={() => void copy(setup.prompt, zh ? "平台專屬安裝提示詞已複製。" : "Platform-specific setup prompt copied.", "prompt")} type="button">{copied === "prompt" ? <Check size={14} /> : <ClipboardCopy size={14} />}{zh ? "複製安裝提示詞" : "Copy setup prompt"}</button></details>
        </> : null}

        <footer><button disabled={pending} onClick={onClose} type="button">{zh ? "稍後再說" : "Not now"}</button>{officialInstallUrl ? <a className="is-primary" href={officialInstallUrl} rel="noreferrer" target="_blank"><ExternalLink size={14} />{primaryLabel}</a> : <button className="is-primary" disabled={!setup || pending} onClick={() => void install()} type="button">{pending ? <LoaderCircle className="spin" size={14} /> : <Cable size={14} />}{pending ? (zh ? "安裝中…" : "Installing…") : primaryLabel}</button>}</footer>
      </section>
    </div>
  );
}

function clientLabel(client: WorkspaceMcpClient) {
  return client === "codex" ? "Codex" : client === "claude-code" ? "Claude Code" : "Claude Desktop";
}

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusOf(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : undefined;
}

function platformName(platform: WorkspaceMcpPlatform) {
  return platform === "macos" ? "macOS" : "Windows";
}
