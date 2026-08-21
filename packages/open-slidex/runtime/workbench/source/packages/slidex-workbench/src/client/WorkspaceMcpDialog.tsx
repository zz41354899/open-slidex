import { useEffect, useState } from "react";
import { Cable, Check, ClipboardCopy, LoaderCircle, MonitorCog, ShieldCheck, X } from "lucide-react";

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

export function WorkspaceMcpDialog({ locale, onClose, onNotice }: Props) {
  const zh = locale === "zh-TW";
  const [client, setClient] = useState<WorkspaceMcpClient>("codex");
  const [platform, setPlatform] = useState<WorkspaceMcpPlatform>("macos");
  const [setup, setSetup] = useState<WorkspaceMcpSetup>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState<"configuration" | "prompt">();

  useEffect(() => {
    let active = true;
    setError("");
    setSetup(undefined);
    void readWorkspaceMcpSetup(client, { platform })
      .then((value) => { if (active) setSetup(value); })
      .catch((reason) => { if (active) setError(messageOf(reason, zh ? "無法準備 MCP 設定。" : "Could not prepare the MCP setup.")); });
    return () => { active = false; };
  }, [client, platform, zh]);

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
      await copy(setup.config, zh ? "Claude Code 指令已複製，貼到終端機後執行即可。" : "Claude Code command copied. Paste and run it in your terminal.");
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
  const primaryLabel = client === "claude-code"
    ? (zh ? "複製安裝指令" : "Copy install command")
    : !canInstallHere
      ? (zh ? "複製設定" : "Copy configuration")
    : (zh ? `安裝到 ${clientLabel(client)}` : `Install in ${clientLabel(client)}`);

  return (
    <div className="osx-workspace-overlay" onMouseDown={() => !pending && onClose()} role="presentation">
      <section aria-labelledby="osx-mcp-title" aria-modal="true" className="osx-mcp-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <button aria-label={zh ? "關閉" : "Close"} className="osx-dialog-close" disabled={pending} onClick={onClose} type="button"><X size={17} /></button>
        <span className="osx-mcp-dialog-icon"><Cable size={20} /></span>
        <small>{zh ? "MCP 快速設定" : "MCP quick setup"}</small>
        <h2 id="osx-mcp-title">{zh ? "連接你的 AI 工作區" : "Connect your AI workspace"}</h2>
        <p>{zh ? "選擇 Agent 與平台分頁。切換 macOS 或 Windows，設定與可複製的安裝提示詞會立即切換。" : "Choose an agent and platform tab. Switching macOS or Windows immediately updates the configuration and copyable setup prompt."}</p>

        <div aria-label={zh ? "MCP 用戶端" : "MCP client"} className="osx-mcp-client-picker" role="group">
          {clients.map((value) => <button className={client === value ? "is-active" : ""} key={value} onClick={() => { setClient(value); setCopied(undefined); }} type="button">{clientLabel(value)}</button>)}
        </div>
        <div className="osx-mcp-platform-section">
          <span>{zh ? "設定平台" : "Setup platform"}</span>
          <div aria-label={zh ? "設定平台" : "Setup platform"} className="osx-mcp-platform-picker" role="group"><button className={platform === "macos" ? "is-active" : ""} onClick={() => { setPlatform("macos"); setCopied(undefined); }} type="button">macOS</button><button className={platform === "windows" ? "is-active" : ""} onClick={() => { setPlatform("windows"); setCopied(undefined); }} type="button">Windows</button></div>
        </div>

        {error ? <div className="osx-workspace-error">{error}</div> : null}
        {!error && !setup ? <div className="osx-mcp-loading"><LoaderCircle className="spin" size={15} />{zh ? "正在準備安全設定…" : "Preparing a safe setup…"}</div> : null}
        {setup ? <>
          <div className="osx-mcp-summary">
            <MonitorCog size={18} /><span><small>{zh ? "設定平台" : "Setup platform"}</small><strong>{platformName(setup.platform)}</strong></span><span><small>{scopeLabel}</small><strong>{setup.scopeRoot}</strong></span><span><small>{zh ? "設定位置" : "Configuration location"}</small><strong>{setup.configPath}</strong></span>
          </div>
          {!setup.clientAvailable && setup.platform === setup.hostPlatform ? <div className="osx-mcp-unavailable">{zh ? "這台電腦未安裝 Claude Desktop，因此不會直接寫入其設定；你仍可複製設定。" : "Claude Desktop is not installed on this computer, so its configuration will not be written here. You can still copy the configuration."}</div> : null}
          <div className="osx-mcp-privacy"><ShieldCheck size={15} /><span>{zh ? "不會啟動 CLI，也不會把你的設定內容傳到瀏覽器。" : "No CLI is started and your configuration contents never reach the browser."}</span></div>
          <details className="osx-mcp-details"><summary>{zh ? "檢視產生的設定" : "View generated configuration"}</summary><pre><code>{setup.config}</code></pre><button onClick={() => void copy(setup.config, zh ? "MCP 設定已複製。" : "MCP configuration copied.")} type="button">{copied === "configuration" ? <Check size={14} /> : <ClipboardCopy size={14} />}{zh ? "複製設定" : "Copy configuration"}</button></details>
          <details className="osx-mcp-details osx-mcp-prompt"><summary>{zh ? "複製平台安裝提示詞" : "Copy platform setup prompt"}</summary><p>{zh ? "提示詞會依目前選取的 macOS／Windows 分頁，帶入正確路徑、步驟與命令。" : "The prompt uses the selected macOS or Windows tab's correct paths, steps, and command."}</p><pre><code>{setup.prompt}</code></pre><button onClick={() => void copy(setup.prompt, zh ? "平台專屬安裝提示詞已複製。" : "Platform-specific setup prompt copied.", "prompt")} type="button">{copied === "prompt" ? <Check size={14} /> : <ClipboardCopy size={14} />}{zh ? "複製安裝提示詞" : "Copy setup prompt"}</button></details>
        </> : null}

        <footer><button disabled={pending} onClick={onClose} type="button">{zh ? "稍後再說" : "Not now"}</button><button className="is-primary" disabled={!setup || pending} onClick={() => void install()} type="button">{pending ? <LoaderCircle className="spin" size={14} /> : <Cable size={14} />}{pending ? (zh ? "安裝中…" : "Installing…") : primaryLabel}</button></footer>
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
