import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { blankPresentationMdx } from "@open-slidex/sdk";
import { closeSlideXChromiumPool, getSlideXQualityCacheStats } from "@open-slidex/sdk/node";
import JSZip from "jszip";
import sharp from "sharp";

import {
  presentationMcpConfig,
  workspaceMcpConfig
} from "@/packages/slidex-workbench/src/server/mcpConfig";
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
    "claude mcp add --scope user open-slidex -- npx -y open-slidex@latest mcp --project '/tmp/OpenSlideX demo'"
  );
  const desktop = JSON.parse(openSlideXMcpConfig("claude-desktop", root));
  assert.equal(desktop.mcpServers.open_slidex.command, "npx");
  assert.equal(desktop.mcpServers.open_slidex.args.at(-1), root);
  const windows = JSON.parse(openSlideXMcpConfig("claude-desktop", "C:\\Decks\\Demo", "windows"));
  assert.equal(windows.mcpServers.open_slidex.command, "cmd");
  assert.deepEqual(windows.mcpServers.open_slidex.args.slice(0, 3), ["/c", "npx", "-y"]);
  const setupPrompt = openSlideXMcpSetupPrompt("codex", root);
  assert.match(setupPrompt, /Show me the exact proposed change/);
  assert.match(setupPrompt, /Replace an older open_slidex entry/);
  assert.doesNotMatch(setupPrompt, /older open_slidex_workspace entry/);

  for (const platform of ["macos", "windows"] as const) {
    for (const client of ["codex", "claude-code", "claude-desktop"] as const) {
      assert.equal(
        openSlideXMcpConfig(client, root, platform),
        presentationMcpConfig(client, root, platform)
      );
      assert.equal(
        openSlideXWorkspaceMcpConfig(client, root, platform),
        workspaceMcpConfig(client, root, platform)
      );
    }
  }
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
        await writeTestStyleCatalog(path.join(skillRoot, "references"));
      }
    }));
    await Promise.all(["alpha", "beta"].map(async (id) => {
      await mkdir(path.join(root, id), { recursive: true });
      await writeFile(path.join(root, id, "presentation.mdx"), blankPresentationMdx.replace("Untitled Presentation", id), "utf8");
    }));
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const packageManifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8")
    ) as { version?: string };
    assert.equal(client.getServerVersion()?.version, packageManifest.version);

    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), [
      "open_slidex_edit",
      "open_slidex_media",
      "open_slidex_read",
      "open_slidex_review",
      "open_slidex_source_import",
      "open_slidex_workspace"
    ]);
    const mediaTool = tools.tools.find((tool) => tool.name === "open_slidex_media");
    assert.ok(mediaTool);
    const mediaProperties = (mediaTool.inputSchema as {
      properties?: Record<string, unknown>;
    }).properties;
    assert.deepEqual(Object.keys(mediaProperties ?? {}).sort(), [
      "action",
      "confirmedByUser",
      "expectedRevision",
      "filePath",
      "providerAssetId",
      "query"
    ]);
    for (const tool of tools.tools) {
      const properties = (tool.inputSchema as {
        properties?: Record<string, { description?: unknown }>;
      }).properties ?? {};
      for (const [propertyName, property] of Object.entries(properties)) {
        assert.equal(
          typeof property.description === "string" && property.description.length > 0,
          true,
          `${tool.name}.${propertyName} needs an AI-readable JSON Schema description.`
        );
      }
    }

    const instructions = client.getInstructions() ?? "";
    assert.ok(instructions.length <= 512, "MCP core instructions must remain useful within the client instruction budget.");
    assert.match(instructions, /open_slidex_workspace/);
    assert.match(instructions, /open_slidex_read/);
    assert.match(instructions, /expectedRevision/);
    assert.match(instructions, /open_slidex_edit/);
    assert.match(instructions, /rendered QA/);
    assert.doesNotMatch(instructions, /30 style/i);
    assert.match(instructions, /\.$/);

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

    const invalidSkillCursor = await client.callTool({
      arguments: {
        resourceCursor: 1,
        resourcePath: ".agents/skills/slidex-deck-design/references/source-to-story.md"
      },
      name: "open_slidex_read"
    });
    assert.equal(invalidSkillCursor.isError, true);
    assert.match(String(structured(invalidSkillCursor).message), /resourceCursor.*knowledge resourcePath/i);

    const missingReviewSlide = await client.callTool({
      arguments: { scope: "slide" },
      name: "open_slidex_review"
    });
    assert.equal(missingReviewSlide.isError, true);
    assert.match(String(structured(missingReviewSlide).message), /slideIndex is required/i);

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
        await writeTestStyleCatalog(path.join(skillRoot, "references"));
      }
    }));
    await mkdir(path.join(root, ".open-slidex"), { recursive: true });
    await writeFile(path.join(root, "presentation.mdx"), `# Untitled Presentation\n\n<Slide duration={5} background="#ffffff"><Text id="first-slide" role="title" x={10} y={20} w={80} h={20} fontSize={42}>First slide</Text></Slide>\n\n<Slide duration={5} background="#f5f5f5"><Text id="second-slide" role="title" x={10} y={20} w={80} h={20} fontSize={42}>Second slide</Text></Slide>`, "utf8");
    await writeFile(path.join(root, "knowledge", "brief.md"), "# Brief\n\nThe launch metric is activation rate.\n", "utf8");
    await writeFile(path.join(root, "source.html"), "<h1>Unsupported source</h1>", "utf8");
    await writeFile(
      path.join(root, "import.png"),
      await sharp({ create: { background: "#3457d5", channels: 4, height: 64, width: 64 } }).png().toBuffer()
    );
    const pptx = new JSZip();
    pptx.file("ppt/presentation.xml", `<p:presentation xmlns:p="x" xmlns:r="y"><p:sldSz cx="13333333" cy="7500000"/><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>`);
    pptx.file("ppt/_rels/presentation.xml.rels", `<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/></Relationships>`);
    pptx.file("ppt/slides/slide1.xml", `<p:sld xmlns:p="x" xmlns:a="y" xmlns:r="z"><p:pic><p:nvPicPr><p:cNvPr id="5" name="Cover" descr="Imported cover"/></p:nvPicPr><p:blipFill><a:blip r:embed="rId5"/></p:blipFill><p:spPr><a:xfrm><a:off x="1333333" y="750000"/><a:ext cx="6666667" cy="3750000"/></a:xfrm></p:spPr></p:pic></p:sld>`);
    pptx.file("ppt/slides/_rels/slide1.xml.rels", `<Relationships><Relationship Id="rId5" Target="../media/image1.png"/></Relationships>`);
    pptx.file("ppt/media/image1.png", await sharp({ create: { background: "#d55d34", channels: 4, height: 48, width: 96 } }).png().toBuffer());
    await writeFile(path.join(root, "source.pptx"), await pptx.generateAsync({ type: "nodebuffer" }));
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const opened = structured(await client.callTool({
      arguments: {},
      name: "open_slidex_read"
    }));
    assert.match(String(opened.revision), /^sha256:/);
    const authoringContract = opened.authoringContract as Record<string, unknown>;
    assert.deepEqual(authoringContract.allowed, ["Text", "ImageBlock", "VideoBlock", "Chart", "Table", "Shape"]);
    assert.deepEqual(authoringContract.removed, ["Card", "Group", "Icon", "Metric", "Notes", "Stack", "Title"]);

    const importedPptx = structured(await client.callTool({
      arguments: { action: "import-media", expectedRevision: opened.revision, filePath: "source.pptx" },
      name: "open_slidex_source_import"
    }));
    const pptxImage = ((importedPptx.slides as Array<Record<string, unknown>>)[0]?.images as Array<Record<string, unknown>>)[0];
    assert.equal(pptxImage?.status, "imported");
    assert.match(String(pptxImage?.source), /^assets\/image1-[a-f0-9]{16}\.webp$/);
    assert.match(String(pptxImage?.imageBlock), /x=\{10\} y=\{10\} w=\{50\} h=\{50\}/);

    const rejectedHtml = await client.callTool({
      arguments: { filePath: "source.html" },
      name: "open_slidex_source_import"
    });
    assert.equal(rejectedHtml.isError, true);
    assert.match(String(structured(rejectedHtml).message), /supports \.pptx files only/);

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
        knowledgeQuery: "activation rate",
        styleQuery: "董事會營運報告，需要企業、乾淨、可信任的視覺方向"
      },
      name: "open_slidex_read"
    }));
    const guidance = context.guidance as Record<string, unknown>;
    assert.equal(guidance.mode, "manifest");
    assert.equal(guidance.intent, "redesign");
    assert.equal((guidance.skills as unknown[]).length, 5);
    assert.equal((guidance.recommended as unknown[]).length, 4);
    const knowledge = context.knowledge as Record<string, unknown>;
    const results = knowledge.results as Array<Record<string, unknown>>;
    assert.equal(results[0]?.path, "brief.md");
    assert.equal(results[0]?.section, "Brief");
    assert.match(String(results[0]?.hash), /^[0-9a-f]{64}$/);
    assert.equal(results[0]?.resourcePath, "knowledge/brief.md");
    assert.equal("content" in results[0]!, false);
    const styleRecommendations = context.styleRecommendations as Record<string, unknown>;
    const recommendedStyles = styleRecommendations.recommendations as Array<Record<string, unknown>>;
    assert.equal(recommendedStyles.length, 3);
    assert.equal(recommendedStyles[0]?.id, "S09");
    assert.match(String(recommendedStyles[0]?.mdxResourcePath), /style-s09-/);

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

async function writeTestStyleCatalog(referenceRoot: string) {
  const selectedIds = ["S01", "S05", "S08", "S09", "S19", "S20", "S25", "S27"];
  const styles = selectedIds.map((id) => {
    const isCorporate = id === "S09";
    return {
      bestFor: isCorporate ? ["board update", "report"] : ["editorial story"],
      category: isCorporate ? "Professional" : "Creative",
      id,
      industries: isCorporate ? ["Corporate"] : ["Creative"],
      keywords: isCorporate ? ["企業", "董事會", "營運", "報告", "乾淨", "可信任"] : [id],
      mdxResourcePath: `.agents/skills/slidex-deck-design/references/style-${id.toLowerCase()}-curated.mdx`,
      name: isCorporate ? "Corporate Clean" : `Style ${id}`
    };
  });
  await writeFile(path.join(referenceRoot, "style-catalog.json"), `${JSON.stringify({ schemaVersion: 1, styles })}\n`, "utf8");
}
