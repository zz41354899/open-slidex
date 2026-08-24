# OpenSlideX MDX-first Local Workbench

This private project is a local OpenSlideX Workspace container. Presentations
are stored only in `open-slidex-workspace/<deck>/presentation.mdx`; there is no
outer `presentation.mdx` file. The editor and SDK come from the one
`open-slidex` package; this project does not contain Next, cloud Workspace
code, AI Chat, or a second canvas state.

Start the Workspace with npm:

```bash
npm run dev
```

The command opens the local Workspace rooted at
`open-slidex-workspace/` inside this project. A fresh install starts with an
empty library; creating or importing a presentation adds an isolated child
folder there. The initial browser route is always `/workspace`.

The command starts the local Node API and a Vite HMR client, then prints the
Workspace URL. Generated HMR files stay under the ignored `.open-slidex/`
directory. The starter does not need a project-level `vite.config.mjs`;
`open-slidex` ships the tested Vite configuration inside its Workbench runtime
and updates it with the installed package. The editor preview is canvas-first, Source provides
CodeMirror and live rendering, Assets manages local media, and Inspector writes
validated SDK source commands. Only valid source is autosaved with revision
protection; invalid work remains a recoverable browser draft.

Use Workspace to create or import a deck. Its local media, source, and exports
live with that deck. The five focused skills in `.agents/skills/` are copied
into every new deck and define source conversion, the MDX contract, art
direction, motion vocabulary, and required visual QA loop. Their `references/` directories cover
prompt, notes, document, research, data, and redesign workflows plus five
verified narrative examples and eight curated native style specimens. For creation
or redesign, MCP can rank those styles from a report or summary and return one
exact MDX resource to load. Load only the resource routed by the active skill;
illustrative content is never factual evidence for a real deck.

Put source notes, Markdown, text, CSV, or PDF research in an inner deck's
`knowledge/` directory. MCP searches locally, returns cited matches, and reads
only the selected source resource.

Configure the user-level Workspace MCP once from OpenSlideX Workspace Settings.
It is restricted to `open-slidex-workspace/`; the desktop agent lists and
selects one inner deck before it reads or edits that deck's `presentation.mdx`.
The generated command uses `open-slidex@latest`; Workspace MCP exposes six
tools: workspace selection, progressive read, PPTX source import, local media
import, review, and revision-safe edit. `open_slidex_source_import` recovers
text geometry and typography hints, converts supported embedded images to
portable WebP, and returns native reviewable `Text` and `ImageBlock` evidence.
