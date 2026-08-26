# Browser-native HTML runtime

OpenSlideX preserves one complete UTF-8 HTML document as a content-addressed
asset and maps its detected pages through a generated, non-authorable
`HtmlEmbedBlock` wrapper.

## Resource boundary

- Inline SVG, CSS, SMIL, and JavaScript may run in playback.
- Absolute HTTP(S) and protocol-relative libraries, styles, fonts, images,
  audio, video, frames, workers, and connections may load at playback time.
- A remote `<base href>` may resolve relative remote resources.
- Workspace folder import copies relative AVIF, GIF, JPEG, PNG, WebP, and SVG
  sidecars into the selected deck's `assets/`. PNG bytes are converted to WebP
  before the HTML reference is rewritten.
- `open_slidex_edit` packages absolute local image paths directly. For relative
  local image references, pass their absolute containing folder as
  `htmlAssetRoot`. The saved canonical HTML must refer only to the packaged
  filenames, not the original filesystem paths.
- Base64 document storage and browser-unsupported protocols are not portable
  inputs. Blob URLs may exist only as runtime values created by the document.

Playback uses an opaque-origin sandbox with scripts but without
`allow-same-origin`. Remote resources cannot receive OpenSlideX local-origin
access. Availability still depends on network access, CORS, framing policy,
authentication, and the remote URL remaining valid.

## Page and export boundary

Page detection uses explicit `[data-slidex-page]`, Gamma-style `.gcard.page`,
native `[data-slidex-slide-index]`, then plain `.slide` elements as the generic
fallback. The detected count maps one-to-one to OpenSlideX slides; a document
without page markers remains a single page. Verify first, middle, and last page
after every material edit.

HTML playback can preserve browser behavior, but arbitrary JavaScript does not
become editable MotionDoc and does not have native PPTX parity. Raster and PPTX
exports must use a complete static state or clearly report the limitation.
