---
name: slidex-html-authoring
description: Read, create, replace, or repair browser-native OpenSlideX HTML presentations. Use for canonical .html source, external browser resources, HTML page mapping, or opaque-origin playback; not for editable native MotionDoc MDX.
---

# OpenSlideX HTML Authoring

Preserve browser-native HTML as canonical source instead of converting its DOM,
CSS, or JavaScript into native MotionDoc layers.

## Required reference

Read [browser runtime](references/browser-runtime.md) before creating or changing
HTML that loads scripts, images, video, fonts, frames, workers, or connections.

## Read and write through the six-tool MCP

1. In Workspace scope, select the intended deck with `open_slidex_workspace`.
2. Call `open_slidex_read` with `sourceFormat: "html"`. Read every chunk when
   `nextCursor` is returned and keep the latest `revision` and `htmlSource`.
3. For a replacement, call `open_slidex_edit` with `target: "html"`, the
   complete HTML in `source`, the returned `htmlSource`, and `expectedRevision`.
   Omit `htmlSource` only when replacing the selected deck with a new HTML deck.
4. Read the saved HTML again and inspect every mapped page in playback.

Never author the generated `HtmlEmbedBlock` wrapper. Never use
`open_slidex_edit` to convert arbitrary HTML into editable MDX. If native
editing or portable PPTX is required, rebuild the visible meaning separately
with `slidex-mdx-authoring`.
