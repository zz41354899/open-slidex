import { Check, Clipboard, Code2, Laptop, MonitorCog, X } from "lucide-react";
import { useEffect, useState } from "react";

import { readMcpSetup, type McpClient, type McpPlatform } from "./api";

type ConnectAiPanelProps = { onClose: () => void };

export function ConnectAiPanel({ onClose }: ConnectAiPanelProps) {
  const [client, setClient] = useState<McpClient>("codex");
  const [platform, setPlatform] = useState<McpPlatform>(() => navigator.platform.toLowerCase().includes("win") ? "windows" : "macos");
  const [setup, setSetup] = useState<Awaited<ReturnType<typeof readMcpSetup>>>();
  const [copied, setCopied] = useState<"config" | "prompt">();

  useEffect(() => {
    let active = true;
    void readMcpSetup(client, platform).then((value) => {
      if (active) setSetup(value);
    });
    return () => { active = false; };
  }, [client, platform]);

  async function copy(kind: "config" | "prompt") {
    const value = kind === "config" ? setup?.config : setup?.prompt;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(undefined), 1600);
  }

  return (
    <div className="dialog-backdrop connect-backdrop" onMouseDown={onClose} role="presentation">
      <section className="connect-panel" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-label="Connect AI">
        <header>
          <div className="connect-title"><span><MonitorCog size={18} /></span><div><strong>Connect your AI</strong><p>Use the account already signed in on this machine.</p></div></div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close connection setup"><X size={16} /></button>
        </header>

        <div className="connect-tabs" role="tablist" aria-label="MCP client">
          {(["codex", "claude-code", "claude-desktop"] as const).map((value) => (
            <button className={client === value ? "is-selected" : ""} key={value} onClick={() => setClient(value)} role="tab" type="button">
              {value === "codex" ? "Codex" : value === "claude-code" ? "Claude Code" : "Claude Desktop"}
            </button>
          ))}
        </div>

        <div className="connect-platform-row">
          <div><Laptop size={15} /><span>Operating system</span></div>
          <div className="platform-segment">
            <button className={platform === "macos" ? "is-selected" : ""} onClick={() => setPlatform("macos")} type="button">macOS</button>
            <button className={platform === "windows" ? "is-selected" : ""} onClick={() => setPlatform("windows")} type="button">Windows</button>
          </div>
        </div>

        <section className="connect-path-card">
          <span>Deck access</span>
          <code>{setup?.projectRoot ?? "Resolving local workspace…"}</code>
          <p>This MCP entry can access this deck only. OpenSlideX never reads your Codex or Claude token.</p>
        </section>

        <section className="connect-code-card">
          <div><span>{setup?.configPath ?? "Client configuration"}</span><button onClick={() => void copy("config")} type="button">{copied === "config" ? <Check size={13} /> : <Clipboard size={13} />}{copied === "config" ? "Copied" : "Copy config"}</button></div>
          <pre>{setup?.config ?? "Generating platform-specific configuration…"}</pre>
        </section>

        <section className="connect-prompt-card">
          <div><Code2 size={15} /><div><strong>Let your desktop agent help</strong><p>Copy a guarded prompt that preserves your existing MCP entries and asks before changing global settings.</p></div></div>
          <button onClick={() => void copy("prompt")} type="button">{copied === "prompt" ? <Check size={14} /> : <Clipboard size={14} />}{copied === "prompt" ? "Prompt copied" : "Copy setup prompt"}</button>
        </section>

        <footer>
          <div className="verify-steps"><span>1</span><p>Save the configuration</p><span>2</span><p>Restart the client</p><span>3</span><p>Run open → edit → render</p></div>
          <button className="primary-button" onClick={onClose} type="button">Done</button>
        </footer>
      </section>
    </div>
  );
}
