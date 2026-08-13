import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, ImagePlus, RefreshCw, Trash2 } from "lucide-react";

import { deleteAsset, listAssets, localWorkbenchApiPath, localWorkbenchAssetUrl, uploadAsset } from "./api";
import type { AssetItem } from "./domain";

type AssetsPanelProps = {
  expectedRevision: string;
  onInsert: (source: string) => void;
  onRefreshDocument: () => Promise<void>;
  onRename: (from: string, to: string) => Promise<void>;
};

export function AssetsPanel({
  expectedRevision,
  onInsert,
  onRefreshDocument,
  onRename
}: AssetsPanelProps) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [message, setMessage] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const next = await listAssets();
    setAssets(next.assets);
  }, []);

  useEffect(() => {
    void refresh();
    const events = new EventSource(localWorkbenchApiPath("/api/v1/events"));
    events.addEventListener("assets.changed", () => void refresh());
    return () => events.close();
  }, [refresh]);

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      const result = await uploadAsset(file, expectedRevision);
      setMessage(`Imported ${result.asset.name}`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Asset import failed.");
    } finally {
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  async function rename(asset: AssetItem) {
    const nextName = window.prompt("Rename asset", asset.name)?.trim();
    if (!nextName || nextName === asset.name) return;
    await onRename(asset.source, `assets/${nextName}`);
    await onRefreshDocument();
    await refresh();
  }

  async function remove(asset: AssetItem) {
    if (asset.usedBy.length > 0) {
      setMessage("This asset is still referenced by presentation.mdx.");
      return;
    }
    if (!window.confirm(`Delete ${asset.name}?`)) return;
    await deleteAsset(asset.source, expectedRevision);
    await refresh();
  }

  return (
    <section className="assets-panel">
      <div className="assets-toolbar">
        <div>
          <strong>Project assets</strong>
          <span>Local WebP files referenced by presentation.mdx</span>
        </div>
        <div>
          <button className="secondary-button" onClick={() => void refresh()} type="button">
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="primary-button" onClick={() => uploadRef.current?.click()} type="button">
            <ImagePlus size={15} /> Import
          </button>
          <input
            accept="image/avif,image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => void upload(event.target.files?.[0])}
            ref={uploadRef}
            type="file"
          />
        </div>
      </div>
      {message ? <div className="asset-message">{message}</div> : null}
      <div className="asset-grid">
        {assets.map((asset) => (
          <article className="asset-card" key={asset.source}>
            <button className="asset-preview" onClick={() => onInsert(asset.source)} type="button">
              <img alt="" src={localWorkbenchAssetUrl(asset.source)} />
            </button>
            <div className="asset-card-meta">
              <div>
                <strong>{asset.name}</strong>
                <span>{formatBytes(asset.bytes)} · {asset.usedBy.length ? "Used" : "Unused"}</span>
              </div>
              <div className="asset-actions">
                <button onClick={() => void navigator.clipboard.writeText(asset.source)} title="Copy path" type="button">
                  <Copy size={14} />
                </button>
                <button onClick={() => void rename(asset)} title="Rename" type="button">Aa</button>
                <button onClick={() => void remove(asset)} title="Delete" type="button">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </article>
        ))}
        {assets.length === 0 ? (
          <button className="asset-empty" onClick={() => uploadRef.current?.click()} type="button">
            <ImagePlus size={24} />
            <strong>Import the first image</strong>
            <span>Files stay inside this workspace.</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
