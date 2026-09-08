@AGENTS.md

# OpenSlideX repository maintenance

`AGENTS.md` is the authority for deck selection and presentation authoring. This
file adds repository-maintenance guidance for Claude Code. Apply both when a
change crosses the runtime and a deck. Never create a presentation source at
the repository root.

## Current architecture

OpenSlideX is React-first. A native deck's canonical source is
`open-slidex-workspace/<deck>/presentation.tsx`, with optional deck-local
`components/*.tsx`. The React source is validated and compiled to serializable
MotionDoc; portable MDX is a generated/export or migration view, not the
canonical authoring source.

Work from the owning source directory:

- `core/react-presentation/`: React TSX parsing, validation, and MotionDoc
  conversion.
- `core/motion-doc/`: native document model, automation, serialization,
  rendering, and export behavior.
- `packages/slidex-sdk/src/`: public browser and Node SDKs, React primitives,
  filesystem adapter, validation, rendering, export, and SDK CLI.
- `packages/open-slidex-mcp/src/`: the official local MCP server and its guarded
  workspace/project boundary.
- `packages/slidex-workbench/src/`: local server, Workspace, and editor client.
- `features/pitch/` and `packages/editor-ui/src/`: shared editor behavior and UI.
- `packages/open-slidex/src/`: public `open-slidex` initializer and command
  router.
- `scripts/`: builds, generated-runtime assembly, package verification, and
  template tooling.

Treat `packages/*/dist/`, `packages/open-slidex/runtime/`, and the starter's
copied skills as generated artifacts. Change their source first, then regenerate
them with the repository scripts.

## React and MotionDoc boundary

- Authored TSX imports `Text`, `Image`, `Video`, `Svg`, `Chart`, `Table`,
  `Shape`, and controlled `HtmlEmbed` from `@open-slidex/sdk/react`.
- Their internal MotionDoc forms include `ImageBlock`, `VideoBlock`,
  `SvgBlock`, and `HtmlEmbedBlock`. Keep internal names out of authored React
  examples and keep React names out of serialized MotionDoc discriminants.
- Removed components such as `Card`, `Metric`, `Stack`, `Group`, `Title`,
  `Icon`, and `Notes` must not return through parser compatibility, migration,
  examples, or documentation.
- Follow behavior across every affected boundary: public input, React
  validation, MotionDoc conversion, persistence, revision hashing, rendering,
  export, Workbench editing, and generated runtime.

## MCP contract

Workspace scope exposes exactly these six workflow tools:

1. `open_slidex_workspace` lists decks and selects one deck for later calls.
2. `open_slidex_read` reads canonical TSX, a deck-local component, portable
   MDX, canonical HTML, skill resources, knowledge resources, and the latest
   revision.
3. `open_slidex_source_import` extracts semantic evidence from PPTX input.
4. `open_slidex_media` ingests staged sources and imports approved media into
   local `knowledge/` and `assets/` paths.
5. `open_slidex_review` runs read-only structural and rendered QA.
6. `open_slidex_edit` applies revision-safe complete deck, slide, or HTML
   replacements; native edits pass the rendered quality gate.

A fixed `--project` MCP scope omits only `open_slidex_workspace`; the other five
tools keep the same schemas and behavior. Browser-native HTML remains inside
`open_slidex_read` (`sourceFormat: "html"`) and `open_slidex_edit` (`target:
"html"`); do not add a separate HTML tool. Extend an existing tool surface
unless a requested contract change justifies changing the public tool count.

Re-read immediately before mutation and pass the returned `expectedRevision`.
Preserve abort signals, root containment, path allowlists, local-asset rules,
and rendered validation when changing MCP handlers. Test the observable MCP
schema and workflow, not only helper functions.

## Skills contract

The six supported project skills are:

1. `slidex-source-import`
2. `slidex-react-authoring`
3. `slidex-html-authoring`
4. `slidex-deck-design`
5. `slidex-motion-direction`
6. `slidex-deck-qa`

Canonical skill content lives in `packages/slidex-workbench/skills/`. Keep the
repository mirror at `.agents/skills/` aligned. `npm run build:runtime` copies
the canonical skills into `packages/open-slidex/template/.agents/skills/` and
`packages/open-slidex/runtime/skills/`; do not repair those generated copies in
isolation. When a skill or reference is renamed, update the allowlist and intent
routing in `core/motion-doc/domain/openSlideXProjectSkills.ts`, all direct
references, the six-entry template catalog when applicable, and the related
tests.

Skill loading is progressive. Read a selected `SKILL.md` completely, then only
the references it routes to. Use `slidex-source-import` only when supplied source
material needs ingestion. For full native creation or redesign, use
`slidex-react-authoring`, `slidex-deck-design`,
`slidex-motion-direction`, and `slidex-deck-qa` in that order.

## Refactoring and MCP/skill consistency

- Inspect the working-tree diff before editing and preserve unrelated changes.
- Preserve literal content, stable layer IDs, local assets, and revision checks
  during migration and source edits. Keep original legacy sources recoverable.
- Do not conclude a refactor from renamed files, types, UI labels, or tool
  descriptions. Confirm that the real SDK, MCP, Workbench, generated starter,
  packaged runtime, rendering, and export paths agree wherever they are in
  scope.
- Document only capabilities exercised through the real SDK/MCP/Workbench
  path. In particular, test custom component expansion and export before
  promising them in skills or tool descriptions.
- Keep OpenSlideX local-only. Do not introduce SlideX Cloud routes, accounts,
  authentication, Supabase state, billing, remote storage, or secret-bearing
  configuration.

## Verification

Run the smallest checks that cover the changed behavior, then broaden only when
the changed boundary requires it:

- `npx tsc --noEmit` for TypeScript consistency.
- `npm run check:skills` for skill discovery and reference checks.
- `npm run test:source` for SDK, MCP, editor, server, and CLI tests.
- `npm run build:runtime` after SDK, Workbench, MCP, CLI, template, or skill
  changes to regenerate the distributable package.
- `node scripts/verify-open-slidex-release.mjs` for package verification after
  building, when packaging or release behavior is in scope.
- `git diff --check` before delivery.

Rendered tests need an available Chrome/Chromium executable. Set
`OPEN_SLIDEX_CHROMIUM_EXECUTABLE` to its actual path when necessary. Distinguish
environment failures from application regressions, and report skipped or
untested browser behavior explicitly. Add focused regression coverage for
confirmed behavioral bugs; existing green tests alone do not prove a refactor
is complete.
