# OpenSlideX MDX-first Local Workbench

This private workspace contains one presentation source: `presentation.mdx`.
The editor and SDK come from the one `open-slidex` package; this project does
not contain Next, cloud Workspace code, AI Chat, or a second canvas state.

Use the same package manager that created the project:

```bash
npm run dev
```

The command opens the local Workspace rooted at this project's parent folder,
so this deck appears in the library alongside its sibling decks. Choose this
deck to enter the editor. The initial browser route is always `/workspace`.

The command starts the local Node API and a Vite HMR client, then prints the
Workspace URL. Generated HMR files stay under the ignored `.open-slidex/`
directory. The editor preview is canvas-first, Source provides
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
agent context stays under ignored `.open-slidex/` and is never synced. Configure
the user-level Workspace MCP once from OpenSlideX Workspace Settings; it lets a
desktop agent select this folder and work directly with `presentation.mdx`.
When started with `npm run dev`, the generated MCP configuration automatically
uses this installed project folder as its direct presentation scope.
