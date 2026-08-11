import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { blankPresentationMdx } from "@open-slidex/sdk";
import { closeSlideXChromiumPool, getSlideXQualityCacheStats } from "@open-slidex/sdk/node";
import sharp from "sharp";

import { openSlideXProjectSkillNames } from "./projectGuidance";
import { createOpenSlideXMcpServer, openSlideXMcpConfig, openSlideXMcpSetupPrompt } from "./server";

test("MCP prints copyable Codex and Claude Code configuration", () => {
  const root = "/tmp/OpenSlideX demo";
  assert.match(openSlideXMcpConfig("codex", root), /\[mcp_servers\.open_slidex\]/);
  assert.match(openSlideXMcpConfig("codex", root), /OpenSlideX demo/);
  assert.equal(
    openSlideXMcpConfig("claude", root),
    "claude mcp add open-slidex -- npx -y open-slidex mcp --project '/tmp/OpenSlideX demo'"
  );
  const desktop = JSON.parse(openSlideXMcpConfig("claude-desktop", root));
  assert.equal(desktop.mcpServers.open_slidex.command, "npx");
  assert.equal(desktop.mcpServers.open_slidex.args.at(-1), root);
  const windows = JSON.parse(openSlideXMcpConfig("claude-desktop", "C:\\Decks\\Demo", "windows"));
  assert.equal(windows.mcpServers.open_slidex.command, "cmd");
  assert.deepEqual(windows.mcpServers.open_slidex.args.slice(0, 3), ["/c", "npx", "-y"]);
  assert.match(openSlideXMcpSetupPrompt("codex", root), /Show me the exact proposed change/);
});

test("MCP performs a real open, CAS edit, render, asset import, and knowledge query", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-mcp-"));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createOpenSlideXMcpServer(root);
  const client = new Client({ name: "open-slidex-test", version: "1.0.0" });

  try {
    await mkdir(path.join(root, "knowledge"));
    await Promise.all(openSlideXProjectSkillNames.map(async (skill) => {
      const skillRoot = path.join(root, ".agents", "skills", skill);
      await mkdir(skillRoot, { recursive: true });
      await writeFile(path.join(skillRoot, "SKILL.md"), `---\nname: ${skill}\ndescription: ${skill} guidance.\n---\n\nUse a coherent visual world.\n`, "utf8");
    }));
    await mkdir(path.join(root, ".open-slidex"), { recursive: true });
    await writeFile(path.join(root, "presentation.mdx"), `${blankPresentationMdx}\n\n<Slide duration={5} background="#f5f5f5"><Text id="second-slide" x={10} y={20} w={80} h={20} fontSize={42}>Second slide</Text></Slide>`, "utf8");
    await writeFile(path.join(root, "knowledge", "brief.md"), "# Brief\n\nThe launch metric is activation rate.\n", "utf8");
    await writeFile(path.join(root, ".open-slidex", "template-lock.json"), `${JSON.stringify({ id: "open-slidex-starter", locale: "en", version: "1.0.0" })}\n`, "utf8");
    await writeFile(
      path.join(root, "import.png"),
      await sharp({ create: { background: "#3457d5", channels: 4, height: 64, width: 64 } }).png().toBuffer()
    );
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const opened = structured(await client.callTool({
      arguments: { includeSource: false },
      name: "open_slidex_open"
    }));
    assert.match(String(opened.revision), /^sha256:/);

    const edited = structured(await client.callTool({
      arguments: {
        commands: [{ title: "Agent edited", type: "document.setTitle" }],
        expectedRevision: opened.revision
      },
      name: "open_slidex_edit"
    }));
    assert.equal(edited.title, "Agent edited");
    assert.notEqual(edited.revision, opened.revision);

    const conflict = await client.callTool({
      arguments: {
        commands: [{ title: "Stale", type: "document.setTitle" }],
        expectedRevision: opened.revision
      },
      name: "open_slidex_edit"
    });
    assert.equal(conflict.isError, true);
    assert.equal(structured(conflict).currentRevision, edited.revision);

    const imported = structured(await client.callTool({
      arguments: { expectedRevision: edited.revision, filePath: "import.png" },
      name: "open_slidex_asset_import"
    }));
    assert.match(String(imported.source), /^assets\/.+\.webp$/);
    assert.ok(Number(imported.bytes) <= Number(imported.targetOutputBytes));

    const escaped = await client.callTool({
      arguments: { expectedRevision: edited.revision, filePath: "../outside.png" },
      name: "open_slidex_asset_import"
    });
    assert.equal(escaped.isError, true);
    assert.match(String(structured(escaped).message), /escapes the configured root/);

    const knowledge = structured(await client.callTool({
      arguments: { limit: 4, query: "activation rate" },
      name: "open_slidex_knowledge_search"
    }));
    const results = knowledge.results as Array<Record<string, unknown>>;
    assert.equal(results[0]?.path, "brief.md");
    assert.equal(results[0]?.section, "Brief");
    assert.match(String(results[0]?.hash), /^[0-9a-f]{64}$/);

    const skill = structured(await client.callTool({
      arguments: { skill: "slidex-deck-design" },
      name: "open_slidex_skill_read"
    }));
    assert.equal(skill.name, "slidex-deck-design");
    assert.match(String(skill.content), /coherent visual world/);

    const guidance = structured(await client.callTool({
      arguments: { intent: "redesign", mode: "bundle" },
      name: "open_slidex_skill_read"
    }));
    assert.equal(guidance.mode, "bundle");
    assert.equal(guidance.intent, "redesign");
    assert.equal((guidance.skills as unknown[]).length, 3);

    const template = structured(await client.callTool({
      arguments: { includeStarterSource: true, referenceMode: "role-samples", roles: ["cover", "next-steps"] },
      name: "open_slidex_template_read"
    }));
    assert.equal(template.id, "open-slidex-starter");
    assert.equal(template.version, "1.0.0");
    assert.match(String(template.starterSource), /<Slide/);
    assert.equal(template.referenceMode, "role-samples");
    const samples = template.referenceSamples as Array<Record<string, unknown>>;
    assert.deepEqual(samples.map((sample) => sample.role), ["cover", "next-steps"]);
    assert.ok(samples.every((sample) => (String(sample.source).match(/<Slide\b/g) ?? []).length === 1));
    assert.ok(samples.reduce((bytes, sample) => bytes + Number(sample.bytes), 0) < 20_000);
    assert.match(String(template.starterSourceChecksum), /^[0-9a-f]{64}$/);
    assert.doesNotMatch(samples.map((sample) => sample.source).join("\n"), /https:|data:|blob:/);
    assert.equal((template.referenceUsage as Record<string, unknown>).mode, "design-reference");
    assert.equal((template.qualityProfile as Record<string, unknown>).schemaVersion, 1);

    const partialTemplate = await client.callTool({
      arguments: { id: "open-slidex-starter" },
      name: "open_slidex_template_read"
    });
    assert.equal(partialTemplate.isError, true);
    assert.match(String(structured(partialTemplate).message), /requires id, locale, and version together/);

    const imageSearch = structured(await client.callTool({
      arguments: { query: "product launch" },
      name: "open_slidex_image_search"
    }));
    assert.equal(imageSearch.status, "not_configured");

    const renderResult = await client.callTool({
      arguments: { mode: "slide", slideIndex: 0 },
      name: "open_slidex_render"
    });
    const rendered = structured(renderResult);
    assert.notEqual(renderResult.isError, true, JSON.stringify(rendered));
    assert.equal(rendered.outputPath, path.join(root, "dist", "renders", String(rendered.revision).replace(/^sha256:/, ""), "slide-0.png"));
    assert.ok((await readFile(String(rendered.outputPath))).byteLength > 1_000);

    const qualityResult = await client.callTool({
      arguments: { mode: "deck" },
      name: "open_slidex_quality_check"
    });
    const quality = structured(qualityResult);
    assert.notEqual(qualityResult.isError, true, JSON.stringify(quality));
    const report = quality.report as Record<string, unknown>;
    assert.equal(report.passed, true);
    assert.equal((report.summary as Record<string, unknown>).errorCount, 0);
    const cacheBefore = getSlideXQualityCacheStats();
    await client.callTool({ arguments: { mode: "deck" }, name: "open_slidex_quality_check" });
    const cacheAfter = getSlideXQualityCacheStats();
    assert.ok(cacheAfter.hits > cacheBefore.hits);
    assert.equal(cacheAfter.misses, cacheBefore.misses);

    const brokenResult = await client.callTool({
      arguments: {
        commands: [{
          slideIndex: 0,
          slideSource: `<Slide duration={5} background="#ffffff">
  <Text id="first" x={8} y={12} w={50} h={3} fontSize={48}>Overlapping headline</Text>
  <Text id="second" x={8} y={12} w={50} h={3} fontSize={48}>Second headline</Text>
</Slide>`,
          type: "slide.replace"
        }],
        expectedRevision: edited.revision
      },
      name: "open_slidex_edit"
    });
    const broken = structured(brokenResult);
    assert.equal(brokenResult.isError, true);
    assert.equal(broken.code, "quality_gate_failed");
    assert.equal(broken.currentRevision, edited.revision);
    const rejectedReport = broken.qualityReport as Record<string, unknown>;
    assert.equal(rejectedReport.passed, false);
    const rejectedCodes = (rejectedReport.issues as Array<Record<string, unknown>>).map((issue) => issue.code);
    assert.ok(rejectedCodes.includes("text_overflow"));
    assert.ok(rejectedCodes.includes("text_collision"));
    assert.match(String(broken.rejectedCandidateId), /^[0-9a-f-]{36}$/i);

    const recovered = structured(await client.callTool({
      arguments: {
        commands: [{
          slideIndex: 0,
          slideSource: `<Slide duration={5} background="#ffffff"><Text id="recovered" x={10} y={20} w={80} h={20} fontSize={48}>Recovered</Text></Slide>`,
          type: "slide.replace"
        }],
        expectedRevision: edited.revision,
        rejectedCandidateId: broken.rejectedCandidateId
      },
      name: "open_slidex_edit"
    }));
    assert.notEqual(recovered.revision, edited.revision);
    assert.equal((recovered.candidateQuality as Record<string, unknown>).passed, true);
    assert.match(String((recovered.preview as Record<string, unknown>).outputPath), /dist\/renders\/.+\/slide-0\.png$/);

    const crossRevisionCacheBefore = getSlideXQualityCacheStats();
    await client.callTool({ arguments: { mode: "deck" }, name: "open_slidex_quality_check" });
    const crossRevisionCacheAfter = getSlideXQualityCacheStats();
    assert.ok(crossRevisionCacheAfter.hits >= crossRevisionCacheBefore.hits + 2);
    assert.equal(crossRevisionCacheAfter.misses, crossRevisionCacheBefore.misses);

    const brokenQuality = structured(await client.callTool({
      arguments: { mode: "slide", slideIndex: 0 },
      name: "open_slidex_quality_check"
    }));
    const brokenReport = brokenQuality.report as Record<string, unknown>;
    assert.equal(brokenReport.passed, true);
    assert.equal(brokenQuality.revision, recovered.revision);
  } finally {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    await closeSlideXChromiumPool();
    await rm(root, { force: true, recursive: true });
  }
});

function structured(result: unknown) {
  const record = result as {
    content?: Array<{ text?: string; type?: string }>;
    structuredContent?: unknown;
  };
  if (record.structuredContent && typeof record.structuredContent === "object") {
    return record.structuredContent as Record<string, unknown>;
  }
  const text = record.content?.find((item) => item.type === "text")?.text;
  assert.ok(text);
  return JSON.parse(text) as Record<string, unknown>;
}
