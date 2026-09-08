# Browser-native HTML runtime

OpenSlideX preserves one complete UTF-8 HTML document as a content-addressed
asset and maps its detected pages through a generated, non-authorable
`HtmlEmbedBlock` wrapper.

## Resource boundary

- Inline SVG, CSS, SMIL, and JavaScript may run in playback.
- Direct HTTP(S), protocol-relative resources, and remote `<base href>` values
  are rejected so imported HTML cannot pivot through the host network.
- Workspace folder import copies relative AVIF, GIF, JPEG, PNG, WebP, and SVG
  sidecars into the selected deck's `assets/`. PNG bytes are converted to WebP
  before the HTML reference is rewritten.
- `open_slidex_edit` accepts relative local image references only when
  `htmlAssetRoot` is a real directory inside the selected deck. Absolute paths,
  `file:` URLs, and symlinks are rejected. Saved HTML refers only to packaged names.
- Base64 document storage and browser-unsupported protocols are not portable
  inputs. Blob URLs may exist only as runtime values created by the document.

Workbench playback uses static images produced by the offline opaque-origin
thumbnail sandbox. Scripts may affect that isolated render, but cannot open
connections; no live untrusted iframe is mounted in the editor.

## Page and export boundary

Page detection uses explicit `[data-slidex-page]`, Gamma-style `.gcard.page`,
native `[data-slidex-slide-index]`, then plain `.slide` elements as the generic
fallback. The detected count maps one-to-one to OpenSlideX slides; a document
without page markers remains a single page. Verify first, middle, and last page
after every material edit.

HTML playback can preserve browser behavior, but arbitrary JavaScript does not
become editable MotionDoc and does not have native PPTX parity. Raster and PPTX
exports must use a complete static state or clearly report the limitation.
