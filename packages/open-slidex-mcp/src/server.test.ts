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
import {
  createOpenSlideXMcpServer,
  openSlideXMcpConfig,
  openSlideXMcpSetupPrompt,
  openSlideXWorkspaceMcpConfig,
  openSlideXWorkspaceMcpSetupPrompt,
  projectRootFromArgs,
  workspaceRootFromArgs
} from "./server";

test("MCP rejects a flag where a project or workspace directory is required", () => {
  assert.throws(
    () => projectRootFromArgs(["--project", "--print-config"]),
    /--project must be followed by a directory/
  );
  assert.throws(
    () => workspaceRootFromArgs(["--workspace", "--print-config"]),
    /--workspace must be followed by a directory/
  );
});

test("MCP prints copyable Codex and Claude Code configuration", () => {
  const root = "/tmp/OpenSlideX demo";
  assert.match(openSlideXMcpConfig("codex", root), /\[mcp_servers\.open_slidex\]/);
  assert.match(openSlideXMcpConfig("codex", root), /OpenSlideX demo/);
  assert.equal(
    openSlideXMcpConfig("claude", root),
    "claude mcp add open-slidex -- npx -y open-slidex@latest mcp --project '/tmp/OpenSlideX demo'"
  );
  const desktop = JSON.parse(openSlideXMcpConfig("claude-desktop", root));
  assert.equal(desktop.mcpServers.open_slidex.command, "npx");
  assert.equal(desktop.mcpServers.open_slidex.args.at(-1), root);
  const windows = JSON.parse(openSlideXMcpConfig("claude-desktop", "C:\\Decks\\Demo", "windows"));
  assert.equal(windows.mcpServers.open_slidex.command, "cmd");
  assert.deepEqual(windows.mcpServers.open_slidex.args.slice(0, 3), ["/c", "npx", "-y"]);
  assert.match(openSlideXMcpSetupPrompt("codex", root), /Show me the exact proposed change/);
  assert.match(openSlideXMcpSetupPrompt("codex", root), /Replace an older open_slidex_workspace entry/);
});

test("Workspace MCP prints user-level configuration and selects a presentation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-workspace-mcp-"));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createOpenSlideXMcpServer({ workspaceRoot: root });
  const client = new Client({ name: "open-slidex-workspace-test", version: "1.0.0" });

  try {
    await Promise.all(openSlideXProjectSkillNames.map(async (skill) => {
      const skillRoot = path.join(root, ".agents", "skills", skill);
      await mkdir(path.join(skillRoot, "references"), { recursive: true });
      await writeFile(path.join(skillRoot, "SKILL.md"), `---\nname: ${skill}\ndescription: ${skill} guidance.\n---\n`, "utf8");
      if (skill === "slidex-deck-design") {
        await writeFile(path.join(skillRoot, "references", "source-to-story.md"), "# Source to story\n", "utf8");
      }
    }));
    await Promise.all(["alpha", "beta"].map(async (id) => {
      await mkdir(path.join(root, id), { recursive: true });
      await writeFile(path.join(root, id, "presentation.mdx"), blankPresentationMdx.replace("Untitled Presentation", id), "utf8");
    }));
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), [
      "open_slidex_edit",
      "open_slidex_media",
      "open_slidex_read",
      "open_slidex_review",
      "open_slidex_workspace"
    ]);

    const listed = structured(await client.callTool({ arguments: { action: "list" }, name: "open_slidex_workspace" }));
    assert.deepEqual((listed.presentations as Array<{ id: string }>).map((item) => item.id).sort(), ["alpha", "beta"]);

    const selected = structured(await client.callTool({
      arguments: { action: "select", presentationId: "beta" },
      name: "open_slidex_workspace"
    }));
    assert.equal(selected.selectedPresentationId, "beta");
    const opened = structured(await client.callTool({ arguments: {}, name: "open_slidex_read" }));
    assert.equal(opened.title, "beta");
    const guidance = opened.guidance as Record<string, unknown>;
    assert.equal(guidance.mode, "manifest");
    assert.equal((guidance.recommended as unknown[]).length, 1);
    assert.equal("references" in opened, false);

    const skillResource = structured(await client.callTool({
      arguments: { resourcePath: ".agents/skills/slidex-deck-design/references/source-to-story.md" },
      name: "open_slidex_read"
    }));
    assert.match(String((skillResource.guidance as Record<string, unknown>).content), /Source to story/);

    assert.match(openSlideXWorkspaceMcpConfig("codex", root), /\[mcp_servers\.open_slidex_workspace\]/);
    assert.match(openSlideXWorkspaceMcpConfig("codex", root), /open-slidex@latest/);
    assert.match(openSlideXWorkspaceMcpConfig("codex", root), /--workspace/);
    assert.match(openSlideXWorkspaceMcpConfig("claude-code", root), /--scope user/);
    assert.match(openSlideXWorkspaceMcpSetupPrompt("codex", root), /open_slidex_workspace/);
  } finally {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    await rm(root, { force: true, recursive: true });
  }
});

test("Workspace MCP lists a not-yet-created starter workspace without failing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-empty-workspace-mcp-"));
  const workspaceRoot = path.join(root, "open-slidex-workspace");
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createOpenSlideXMcpServer({ workspaceRoot });
  const client = new Client({ name: "open-slidex-empty-workspace-test", version: "1.0.0" });

  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const listed = structured(await client.callTool({ arguments: { action: "list" }, name: "open_slidex_workspace" }));

    assert.deepEqual(listed.presentations, []);
    assert.equal(listed.selectedPresentationId, undefined);
    assert.equal(listed.workspaceRoot, workspaceRoot);

    const opened = await client.callTool({ arguments: {}, name: "open_slidex_read" });
    assert.equal(opened.isError, true);
    assert.match(String(structured(opened).message), /has no presentations/i);
  } finally {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    await rm(root, { force: true, recursive: true });
  }
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
      await mkdir(path.join(skillRoot, "references"), { recursive: true });
      await writeFile(path.join(skillRoot, "SKILL.md"), `---\nname: ${skill}\ndescription: ${skill} guidance.\n---\n\nUse a coherent visual world.\n`, "utf8");
      if (skill === "slidex-deck-design") {
        await writeFile(path.join(skillRoot, "references", "source-to-story.md"), "# Source to story\n", "utf8");
      }
    }));
    await mkdir(path.join(root, ".open-slidex"), { recursive: true });
    await writeFile(path.join(root, "presentation.mdx"), `# Untitled Presentation\n\n<Slide duration={5} background="#ffffff"><Text id="first-slide" role="title" x={10} y={20} w={80} h={20} fontSize={42}>First slide</Text></Slide>\n\n<Slide duration={5} background="#f5f5f5"><Text id="second-slide" role="title" x={10} y={20} w={80} h={20} fontSize={42}>Second slide</Text></Slide>`, "utf8");
    await writeFile(path.join(root, "knowledge", "brief.md"), "# Brief\n\nThe launch metric is activation rate.\n", "utf8");
    await writeFile(
      path.join(root, "import.png"),
      await sharp({ create: { background: "#3457d5", channels: 4, height: 64, width: 64 } }).png().toBuffer()
    );
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const opened = structured(await client.callTool({
      arguments: {},
      name: "open_slidex_read"
    }));
    assert.match(String(opened.revision), /^sha256:/);
    const authoringContract = opened.authoringContract as Record<string, unknown>;
    assert.deepEqual(authoringContract.allowed, ["Text", "ImageBlock", "VideoBlock", "Chart", "Table", "Shape"]);
    assert.deepEqual(authoringContract.removed, ["Card", "Group", "Icon", "Metric", "Notes", "Stack", "Title"]);

    const edited = structured(await client.callTool({
      arguments: {
        expectedRevision: opened.revision,
        source: String(opened.source).replace("# Untitled Presentation", "# Agent edited"),
        target: "deck"
      },
      name: "open_slidex_edit"
    }));
    assert.equal(edited.title, "Agent edited", JSON.stringify(edited));
    assert.notEqual(edited.revision, opened.revision);

    const conflict = await client.callTool({
      arguments: {
        expectedRevision: opened.revision,
        source: String(opened.source).replace("# Untitled Presentation", "# Stale"),
        target: "deck"
      },
      name: "open_slidex_edit"
    });
    assert.equal(conflict.isError, true);
    assert.equal(structured(conflict).currentRevision, edited.revision);

    const forbiddenCard = await client.callTool({
      arguments: {
        expectedRevision: edited.revision,
        slideIndex: 0,
        source: `<Slide duration={5}><Card title="Wrong"><Text id="nested" x={10} y={10} w={40} h={10}>Nested</Text></Card></Slide>`,
        target: "slide"
      },
      name: "open_slidex_edit"
    });
    assert.equal(forbiddenCard.isError, true);
    assert.match(String(structured(forbiddenCard).message), /Unsupported MotionDoc component: Card/);

    for (const [component, source] of [
      ["Icon", `<Slide duration={5}><Icon id="legacy" x={10} y={10} w={10} h={10} icon="Sparkles" /></Slide>`],
      ["Notes", `<Slide duration={5}><Notes>Legacy notes</Notes></Slide>`]
    ] as const) {
      const forbiddenLegacy = await client.callTool({
        arguments: {
          expectedRevision: edited.revision,
          slideIndex: 0,
          source,
          target: "slide"
        },
        name: "open_slidex_edit"
      });
      assert.equal(forbiddenLegacy.isError, true);
      assert.match(String(structured(forbiddenLegacy).message), new RegExp(`Unsupported MotionDoc component: ${component}`));
    }

    const forbiddenMarkdown = await client.callTool({
      arguments: {
        expectedRevision: edited.revision,
        slideIndex: 0,
        source: `<Slide duration={5}>## Unpositioned heading</Slide>`,
        target: "slide"
      },
      name: "open_slidex_edit"
    });
    assert.equal(forbiddenMarkdown.isError, true);
    assert.match(String(structured(forbiddenMarkdown).message), /visible Markdown/);
    const unchangedAfterForbidden = structured(await client.callTool({ arguments: {}, name: "open_slidex_read" }));
    assert.equal(unchangedAfterForbidden.revision, edited.revision);
    assert.match(String(unchangedAfterForbidden.source), /Agent edited/);

    const imported = structured(await client.callTool({
      arguments: { action: "import-local", expectedRevision: edited.revision, filePath: "import.png" },
      name: "open_slidex_media"
    }));
    assert.match(String(imported.source), /^assets\/.+\.webp$/);
    assert.ok(Number(imported.bytes) <= Number(imported.targetOutputBytes));

    const escaped = await client.callTool({
      arguments: { action: "import-local", expectedRevision: edited.revision, filePath: "../outside.png" },
      name: "open_slidex_media"
    });
    assert.equal(escaped.isError, true);
    assert.match(String(structured(escaped).message), /escapes the configured root/);

    const context = structured(await client.callTool({
      arguments: {
        intent: "redesign",
        knowledgeQuery: "activation rate"
      },
      name: "open_slidex_read"
    }));
    const guidance = context.guidance as Record<string, unknown>;
    assert.equal(guidance.mode, "manifest");
    assert.equal(guidance.intent, "redesign");
    assert.equal((guidance.skills as unknown[]).length, 4);
    assert.equal((guidance.recommended as unknown[]).length, 4);
    const knowledge = context.knowledge as Record<string, unknown>;
    const results = knowledge.results as Array<Record<string, unknown>>;
    assert.equal(results[0]?.path, "brief.md");
    assert.equal(results[0]?.section, "Brief");
    assert.match(String(results[0]?.hash), /^[0-9a-f]{64}$/);
    assert.equal(results[0]?.resourcePath, "knowledge/brief.md");
    assert.equal("content" in results[0]!, false);

    const knowledgeResource = structured(await client.callTool({
      arguments: { resourcePath: "knowledge/brief.md" },
      name: "open_slidex_read"
    }));
    const resourceChunks = ((knowledgeResource.knowledge as Record<string, unknown>).chunks as Array<Record<string, unknown>>);
    assert.match(String(resourceChunks[0]?.content), /activation rate/);

    const imageSearch = structured(await client.callTool({
      arguments: { action: "search-trusted", query: "product launch" },
      name: "open_slidex_media"
    }));
    assert.equal(imageSearch.status, "not_configured");

    const renderResult = await client.callTool({
      arguments: { scope: "slide", slideIndex: 0 },
      name: "open_slidex_review"
    });
    const rendered = structured(renderResult);
    assert.notEqual(renderResult.isError, true, JSON.stringify(rendered));
    const renderedPreview = rendered.preview as Record<string, unknown>;
    assert.equal(renderedPreview.outputPath, path.join(root, "dist", "renders", String(rendered.revision).replace(/^sha256:/, ""), "slide-0.png"));
    assert.ok((await readFile(String(renderedPreview.outputPath))).byteLength > 1_000);

    const qualityResult = await client.callTool({
      arguments: { scope: "deck" },
      name: "open_slidex_review"
    });
    const quality = structured(qualityResult);
    assert.notEqual(qualityResult.isError, true, JSON.stringify(quality));
    const report = quality.report as Record<string, unknown>;
    assert.equal(report.passed, true);
    assert.equal((report.summary as Record<string, unknown>).errorCount, 0);
    const cacheBefore = getSlideXQualityCacheStats();
    await client.callTool({ arguments: { scope: "deck" }, name: "open_slidex_review" });
    const cacheAfter = getSlideXQualityCacheStats();
    assert.ok(cacheAfter.hits > cacheBefore.hits);
    assert.equal(cacheAfter.misses, cacheBefore.misses);

    const brokenResult = await client.callTool({
      arguments: {
        expectedRevision: edited.revision,
        slideIndex: 0,
        source: `<Slide duration={5} background="#ffffff">
  <Text id="first" x={8} y={12} w={50} h={3} fontSize={48}>Overlapping headline</Text>
  <Text id="second" x={8} y={12} w={50} h={3} fontSize={48}>Second headline</Text>
</Slide>`,
        target: "slide"
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
        expectedRevision: edited.revision,
        rejectedCandidateId: broken.rejectedCandidateId,
        slideIndex: 0,
        source: `<Slide duration={5} background="#ffffff"><Text id="recovered" x={10} y={20} w={80} h={20} fontSize={48}>Recovered</Text></Slide>`,
        target: "slide"
      },
      name: "open_slidex_edit"
    }));
    assert.notEqual(recovered.revision, edited.revision);
    assert.equal((recovered.candidateQuality as Record<string, unknown>).passed, true);
    assert.match(String((recovered.preview as Record<string, unknown>).outputPath), /dist\/renders\/.+\/slide-0\.png$/);

    const crossRevisionCacheBefore = getSlideXQualityCacheStats();
    await client.callTool({ arguments: { scope: "deck" }, name: "open_slidex_review" });
    const crossRevisionCacheAfter = getSlideXQualityCacheStats();
    assert.ok(crossRevisionCacheAfter.hits >= crossRevisionCacheBefore.hits + 2);
    assert.equal(crossRevisionCacheAfter.misses, crossRevisionCacheBefore.misses);

    const brokenQuality = structured(await client.callTool({
      arguments: { scope: "slide", slideIndex: 0 },
      name: "open_slidex_review"
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
