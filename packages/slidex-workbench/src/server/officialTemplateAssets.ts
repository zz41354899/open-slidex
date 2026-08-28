import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { TemplatePackageV1 } from "@open-slidex/sdk";

export type BundledOfficialTemplateAsset = TemplatePackageV1["assets"][number] & { bytesData: Buffer };

/**
 * Official assets are copied with the Workbench source into the packaged runtime.
 * Keeping the bytes as files preserves portable local media without storing Base64
 * in a template package or the generated presentation source.
 */
export async function readBundledOfficialTemplateAssets(template: TemplatePackageV1): Promise<BundledOfficialTemplateAsset[]> {
  return Promise.all(template.assets.map(async (asset) => {
    const source = await resolveBundledTemplateAsset(template.id, asset.path);
    const bytesData = await readFile(source);
    const sha256 = createHash("sha256").update(bytesData).digest("hex");
    if (bytesData.byteLength !== asset.bytes || sha256 !== asset.sha256) {
      throw new Error(`Bundled template asset integrity check failed: ${template.id}/${asset.path}`);
    }
    return { ...asset, bytesData };
  }));
}

export async function copyBundledOfficialTemplateAssets(template: TemplatePackageV1, projectRoot: string) {
  const assets = await readBundledOfficialTemplateAssets(template);
  await Promise.all(assets.map(async (asset) => {
    const target = path.join(projectRoot, asset.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, asset.bytesData, { flag: "wx" });
  }));
}

export async function materializeBundledOfficialTemplateAssets(template: TemplatePackageV1, projectRoot: string) {
  const assets = await readBundledOfficialTemplateAssets(template);
  await Promise.all(assets.map(async (asset) => {
    const target = path.join(projectRoot, asset.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, asset.bytesData);
  }));
  return assets;
}

async function resolveBundledTemplateAsset(templateId: string, assetPath: string) {
  const fileName = path.basename(assetPath);
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(moduleDirectory, "official-template-assets", templateId, fileName),
    path.join(moduleDirectory, "source", "packages", "slidex-workbench", "src", "server", "official-template-assets", templateId, fileName)
  ];
  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {
      // The first location is used from source; the second is used by the packaged runtime.
    }
  }
  throw new Error(`Bundled template asset is missing: ${templateId}/${assetPath}`);
}
