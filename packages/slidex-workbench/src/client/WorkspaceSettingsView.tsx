import {
  CheckCircle2, HardDrive, Languages, ShieldCheck, Upload
} from "lucide-react";

import type { LocalWorkspaceSnapshot } from "./api";

type Props = {
  locale: "en" | "zh-TW";
  onImport(): void;
  onLocale(value: "en" | "zh-TW"): void;
  workspace: LocalWorkspaceSnapshot;
};

export function WorkspaceSettingsView({ locale, onImport, onLocale, workspace }: Props) {
  const zh = locale === "zh-TW";

  return (
    <div className="osx-settings-view">
      <section className="osx-settings-card is-overview"><span className="osx-settings-icon"><HardDrive size={20} /></span><div className="osx-settings-copy"><small>{zh ? "本機工作區" : "Local workspace"}</small><strong>{workspace.name}</strong><p>{zh ? "所有簡報都以獨立資料夾儲存在這個位置。" : "Every presentation is stored here in its own folder."}</p><code>{workspace.root}</code></div><em className="osx-settings-status"><i />{zh ? "本機可用" : "Available locally"}</em></section>
      <section className="osx-settings-card"><header><span className="osx-settings-icon"><Languages size={19} /></span><div><small>{zh ? "介面" : "Interface"}</small><strong>{zh ? "顯示語言" : "Display language"}</strong></div></header><p>{zh ? "切換 Workspace 的選單、提示與日期格式。" : "Change Workspace menus, prompts, and date formatting."}</p><div aria-label={zh ? "介面語言" : "Interface language"} className="osx-settings-segmented" role="group"><button className={locale === "zh-TW" ? "is-active" : ""} onClick={() => onLocale("zh-TW")} type="button">繁體中文</button><button className={locale === "en" ? "is-active" : ""} onClick={() => onLocale("en")} type="button">English</button></div></section>
      <section className="osx-settings-card"><header><span className="osx-settings-icon"><ShieldCheck size={19} /></span><div><small>{zh ? "資料與隱私" : "Data and privacy"}</small><strong>{zh ? "完全本機" : "Fully local"}</strong></div></header><p>{zh ? "不需要登入，不使用 Supabase，也沒有背景同步。" : "No login, Supabase, or background sync is used."}</p><ul><li><CheckCircle2 size={14} />{zh ? "簡報來源固定為 presentation.mdx" : "presentation.mdx remains the only source"}</li><li><CheckCircle2 size={14} />{zh ? "檔案只存在於你的裝置" : "Files stay on this device"}</li></ul></section>
      <section className="osx-settings-card is-import"><span className="osx-settings-icon"><Upload size={20} /></span><div className="osx-settings-copy"><small>{zh ? "簡報匯入" : "Presentation import"}</small><strong>{zh ? "可攜式 MotionDoc MDX" : "Portable MotionDoc MDX"}</strong><p>{zh ? "新匯出的 MDX 會把圖片一起帶走，匯入時自動還原成 assets/*.webp；舊格式缺圖也不會阻止匯入。" : "New MDX exports carry images and restore them to assets/*.webp. Missing images in older files no longer block import."}</p></div><button onClick={onImport} type="button"><Upload size={15} />{zh ? "選擇匯入檔" : "Choose import file"}</button></section>
    </div>
  );
}
