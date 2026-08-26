# Browser-native HTML runtime

OpenSlideX preserves one complete UTF-8 HTML document as a content-addressed
asset and maps its detected pages through a generated, non-authorable
`HtmlEmbedBlock` wrapper.

## Resource boundary

- Inline SVG, CSS, SMIL, and JavaScript may run in playback.
- Absolute HTTP(S) and protocol-relative libraries, styles, fonts, images,
  audio, video, frames, workers, and connections may load at playback time.
- A remote `<base href>` may resolve relative remote resources.
- Unresolved local sidecars, `file:`, Base64 document storage, blob URLs, and
  browser-unsupported protocols are not portable inputs.

Playback uses an opaque-origin sandbox with scripts but without
`allow-same-origin`. Remote resources cannot receive OpenSlideX local-origin
access. Availability still depends on network access, CORS, framing policy,
authentication, and the remote URL remaining valid.

## Page and export boundary

Use explicit `[data-slidex-page]`, Gamma-style `.gcard.page`, or a supported
native exported-page marker when one document contains multiple pages. Verify
page order after every material edit.

HTML playback can preserve browser behavior, but arbitrary JavaScript does not
become editable MotionDoc and does not have native PPTX parity. Raster and PPTX
exports must use a complete static state or clearly report the limitation.
