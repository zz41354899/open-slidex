# OpenSlideX React-first Local Workbench

This project is a Workspace container. Presentations live only at

`open-slidex-workspace/<deck>/presentation.tsx`

Never create or use an outer `presentation.tsx`.

## Select and read before editing

1. Use `open_slidex_workspace` to list decks and explicitly select the intended
   inner deck.
2. Call `open_slidex_read` immediately before editing. Read the complete deck
   source for whole-deck work or the complete slide source for a focused edit.
3. When the user refers to this slide or this layer, read the selected deck's
   `.open-slidex/current.json` immediately before choosing the target.
4. Keep every deck's assets, exports, and `.open-slidex/` state inside that deck.
   Preserve unrelated workspace files.

## React presentation contract

- Every visible object must be a native, serializable MotionDoc layer.
- Import React presentation primitives from `@open-slidex/sdk/react`. The native
  visual components are `Text`, `Image`, `Video`, `Svg`, `Chart`, `Table`, and
  `Shape`. Controlled workspace HTML imports may use `HtmlEmbed`.
- `Card`, `Metric`, `Stack`, `Group`, `Title`, `Icon`, and `Notes` are removed
  components. They are invalid and must not be authored, parsed, migrated
  silently, or retained for compatibility. Rebuild visible meaning from native
  layers.
- Use `<Text role="title">` for titles. For grouped editing, put the same
  `groupId` and optional `groupName` on each native child; never emit a Group
  tag.
- Give every visible layer a stable `id` and explicit percentage `x`, `y`, `w`,
  and `h`; use points for `fontSize`.
- Allow only React, `@open-slidex/sdk/react`, and relative deck imports. Never
  use Node APIs, handlers, external npm imports, network calls, arbitrary HTML,
  cross-deck paths, or unregistered components. Dynamic expressions are code-only.
- Prefer assets already present in the selected deck's `assets/`. Never invent
  media URLs or persist Base64, blob URLs, or absolute paths.

## Quality workflow

- Skill loading is progressive. Read the recommended `SKILL.md`, then only the
  direct `references/` files it routes to. Do not load every example.
- For supplied Markdown, text, CSV, PDF, or image input, load
  `slidex-source-import`. Stage local attachments under the configured root's
  `.open-slidex-inbox/`, call `open_slidex_media` with `action:
  "ingest-source"`, then read its returned `knowledge/...` resources. Use only
  returned `assets/...` paths in `ImageBlock`; never persist source URLs.
- For a supplied `.pptx`, first load `slidex-source-import`
  and use `open_slidex_source_import`; rebuild its semantic evidence with
  native MotionDoc layers rather than copying foreign markup.
- For a full creation or redesign, use
  `.agents/skills/slidex-deck-design/references/` to classify the input, choose
  one narrative pattern, and read the closest componentized TSX example. Borrow
  composition principles, never sample claims.
- Put user notes, documents, datasets, and research under the selected deck's
  `knowledge/`. Search first, then read only the returned source resources.
- For browser-native HTML, load `slidex-html-authoring`. Use
  `open_slidex_read` with `sourceFormat: "html"` to list or chunk-read the
  canonical source, then `open_slidex_edit` with `target: "html"` and the latest
  revision to create or replace it. Pass `htmlAssetRoot` only for relative local
  images under a real directory inside the selected deck; absolute paths,
  `file:` URLs, symlinks, and remote network resources are rejected. PNG is
  converted to WebP and saved HTML is rewritten to the deck's `assets/`. Inline
  resources render in an offline opaque-origin thumbnail sandbox; Workbench
  playback uses the resulting static images. Never author `HtmlEmbedBlock`.
  For a full HTML creation or redesign, then load `slidex-deck-design`,
  `slidex-motion-direction`, and `slidex-deck-qa` in that order.
- Submit one complete deck or one complete slide to `open_slidex_edit` with the
  latest revision. Patch a rejected candidate from its node-specific findings.
- Use `open_slidex_review` only for review-only work. An accepted edit already
  includes structural validation, rendered QA, and an immutable preview.
- Use the official `open-slidex mcp` server only. Do not add a second server or
  persisted canvas state.

Apply the project-local skills in this order for a full creation or redesign:

1. `slidex-react-authoring`
2. `slidex-deck-design`
3. `slidex-motion-direction`
4. `slidex-deck-qa`
