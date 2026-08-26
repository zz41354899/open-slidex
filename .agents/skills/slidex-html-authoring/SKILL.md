---
name: slidex-html-authoring
description: Read, create, replace, or repair browser-native OpenSlideX HTML presentations. Use for canonical .html source, external browser resources, HTML page mapping, or opaque-origin playback; not for editable native MotionDoc MDX.
---

# OpenSlideX HTML Authoring

Preserve browser-native HTML as canonical source instead of converting its DOM,
CSS, or JavaScript into native MotionDoc layers.

## Progressive route

Read [browser runtime](references/browser-runtime.md) before creating or changing
HTML that loads scripts, images, video, fonts, frames, workers, or connections.

For a polished consulting, investment, financial, or long-form HTML deck, also
read [the IDAEO and Nov reference grammar](references/ref-idaeo-nov.md). It
extracts reusable composition and pacing from the two approved reference decks
without copying their claims, brands, or private content. Then follow the
recommended `slidex-deck-design`, `slidex-motion-direction`, and
`slidex-deck-qa` guidance returned by the HTML manifest.

## Read and write through the six-tool MCP

1. In Workspace scope, select the intended deck with `open_slidex_workspace`.
2. Call `open_slidex_read` with `sourceFormat: "html"`. Read every chunk when
   `nextCursor` is returned and keep the latest `revision` and `htmlSource`.
3. For a replacement, call `open_slidex_edit` with `target: "html"`, the
   complete HTML in `source`, the returned `htmlSource`, and `expectedRevision`.
   Omit `htmlSource` only when replacing the selected deck with a new HTML deck.
   When `source` contains relative local images, also pass the absolute folder
   containing those sidecars as `htmlAssetRoot`. Absolute local image paths do
   not need an asset root. The edit copies those images into the selected
   deck's `assets/`, converts PNG to WebP, and rewrites the canonical HTML.
4. Read the saved HTML again and inspect every mapped page in playback. Confirm
   the returned `pageCount` matches the source deck, including plain `.slide`
   HTML exports. For long decks, verify every page thumbnail plus first, middle,
   and last full-screen playback states.

## Authored HTML contract

- Prefer one explicit `[data-slidex-page]` element per page. Legacy `.gcard.page`
  and plain `.slide` exports remain supported, but explicit markers are the most
  deterministic authoring contract.
- Use a 16:9 stage, semantic HTML, shared CSS design tokens, stable page numbers,
  and a complete static final state. Keep interaction and animation local to
  the document and honor `prefers-reduced-motion`.
- Inline SVG and CSS remain part of the canonical HTML and therefore do not
  appear as separate files in `assets/`. Only referenced local sidecars are
  copied there. Never manufacture duplicate asset files merely to make the
  folder look populated.
- Full-screen projection must not depend on editor chrome, local absolute paths,
  Base64 document storage, or browser extensions.

Never author the generated `HtmlEmbedBlock` wrapper. Never use
`open_slidex_edit` to convert arbitrary HTML into editable MDX. If native
editing or portable PPTX is required, rebuild the visible meaning separately
with `slidex-mdx-authoring`.
