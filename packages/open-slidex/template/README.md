# OpenSlideX MDX-first Local Workbench

This private workspace contains one presentation source: `presentation.mdx`.
The editor, SDK, and local MCP runtime come from the one `open-slidex` package;
this project does not contain Next, cloud Workspace code, or a second canvas
state. The local MCP connects coding agents to this same file.

Use the same package manager that created the workspace:

```bash
npm run dev
```

The command prints the localhost URL. Preview is canvas-first, Source provides
CodeMirror and live rendering, Assets manages local media, and Inspector writes
validated SDK source commands. Only valid source is autosaved with revision
protection; invalid work remains a recoverable browser draft.

CLI validation and export remain available:

```bash
npm run validate
npm run render
npm run export:html
npm run export:mdx
npm run export:pptx
```

Local media belongs in `assets/`; generated renders and exports belong in
`dist/`. The four focused skills in `.agents/skills/` define the MDX contract,
deck art direction, motion vocabulary, and required visual QA loop.

CommonMark headings, paragraphs, bold, italic, links, blockquotes, code, and
ordered or unordered lists may appear inside `<Slide>`. `<Group>` organizes
native layers. `<Notes>` stores presenter-only CommonMark speaker notes.
Built-in JSX blocks such as `<Chart>` are React-rendered while remaining strict,
serializable MotionDoc source. Put private reference material in `knowledge/`;
the local MCP index stays under ignored `.open-slidex/` and is never synced.
