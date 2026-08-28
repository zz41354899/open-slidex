# Morph panel design QA

- Source visual truth: `/var/folders/fp/bv98vn2s2v9dchl651zpsvn00000gn/T/TemporaryItems/NSIRD_screencaptureui_SjasVV/截圖 2026-08-27 下午4.32.01.png`
- Implementation target: OpenSlideX Workbench at `http://127.0.0.1:4172/workspace`
- Captured implementation: `/private/tmp/open-slidex-morph-slide-sequence-1279x825.png`
- Side-by-side comparison: `/private/tmp/open-slidex-morph-sequence-comparison-1279x825.png`
- Intended state: a multi-slide Morph group selected with its slide sequence expanded

## Implemented fidelity surfaces

- The right Inspector now uses one complete dark, violet-accented Morph system rather
  than mixing the former transition card with a separate settings module.
- The panel hierarchy follows the selected mock: Morph summary, live start/end preview,
  curve selector, curve graph, compact controls, slide summary, primary Preview action,
  and one advanced disclosure.
- The left rail collapses a Morph sequence into one diamond-marked group card; expanding
  reveals start/end slides and interaction hints.
- Click Areas and Slide Morph are now separate slide-level tabs. Element motion remains
  inside the selected element's own Actions panel instead of being mixed into Morph.
- Unlinking a Morph group now restores every member as an ordinary independent slide,
  clears its shared identities, and removes the former same-content badges.
- The primary preview action is labelled Preview Effect and replays on the central canvas.
- Presentation preview and exported HTML flash purple outlines over available click areas
  after a blank click instead of silently advancing.
- The former layer-pairing editor is now a Morph slide sequence with start, intermediate,
  and end roles. Every row contains a real slide thumbnail and selects that slide.
- Add Morph Slide appends a new editable continuation, preserves shared identities between
  adjacent pages, regenerates native block IDs, and leaves no dangling final transition.
- Every slide in a Morph sequence is now labelled as a Morph slide. Detail rows expose a
  Return Morph switch, while the first row is identified as the overview.
- Overview click areas may Morph directly to any detail slide, not only the adjacent one;
  each detail object keeps its own shared identity and can Morph back to the overview.
- Return Morph now keeps every unmatched source object in the transition overlay until it
  finishes fading out. Destination content fades in once at the scene level, avoiding the
  former first-frame disappearance and doubled opacity animation.
- Unmatched content is named as content instead of exposing the underlying layer model.
- All visible new UI strings have English and Traditional Chinese variants.

## Functional verification

- 24 focused SDK and Workbench interaction tests pass for this iteration, including the
  multi-slide continuation and bidirectional return-link behavior.
- Production runtime build passes.
- The rebuilt Workbench is running on port 4172 and the active document route returns 200.
- Custom curve zero values survive HTML dataset parsing.
- Morph preview is dispatched from the Inspector into the central canvas and is cancelled
  and rebuilt for each replay.
- Invalid saves now include the first MotionDoc validation path and message in the client
  error, making any future 422 response actionable.
- The in-app browser loaded the 4172 editor, expanded Advanced Settings, and exposed the
  complete slide sequence and Add Morph Slide control. Browser errors and warnings: none.

## Visual comparison

The reference and implementation were captured at 1279×825 and inspected together. The
existing dark Workbench composition, violet Morph accent, left grouped-slide card, canvas
scale, and Inspector density remain consistent. The former layer rows are replaced by a
clear vertical slide sequence without introducing new layout, clipping, contrast, or
spacing regressions. No P0, P1, or P2 visual issues remain.

Morph QA result: passed

---

# Action sequence mini-timeline design QA

- Source visual truth: `/Users/zz41354899/.codex/generated_images/01a04159-0a46-78b1-9223-14085c6eaaff/exec-9e074146-5dab-4f4b-b86b-4aa6cc28b666.png`
- Source pixels: 1717 × 916
- Implementation target: OpenSlideX Workbench at `http://127.0.0.1:4198/workspace/presentation-20260827041849`
- Intended viewport: desktop Workbench, dark theme, expanded sequence with six actions and the first action selected
- Implementation screenshot: unavailable
- Density normalization: not performed because the rendered implementation could not be captured

## Implemented fidelity surfaces

- Fonts and typography: reuses the Workbench font stack and compact 8–11 px UI scale; selected layer names use the stronger weight shown in the source.
- Spacing and layout rhythm: one 1180 px maximum-width floating dock, 44 px header, 54 px action nodes, 8 px node gaps, and a larger selected node reproduce the source hierarchy without introducing a full editing timeline.
- Colors and visual tokens: reuses the Workbench neutral surfaces, violet selection accent, translucent borders, blur, and elevation.
- Image and icon fidelity: the target contains only interface icons; the implementation uses the project's existing Lucide icon system and adds no placeholder or handcrafted image assets.
- Copy and content: Actions, item count, trigger type, duration, preview, collapse, drag, and keyboard-reorder labels are available in English and Traditional Chinese.

## Functional evidence

- The selected action expands and dispatches the existing canvas/action-selection event.
- Dragging exposes a violet insertion marker and swaps action order on drop.
- Alt + Left/Right provides keyboard reordering; focus rings and pressed state are exposed.
- Preview replays every cue in sequence on the central canvas using the shared deterministic playback controller.
- The dock can collapse to its compact header.
- Focused Workbench interaction tests pass: 21/21.
- Production Workbench build passes.

## Findings

- [P1] Rendered fidelity and interaction state could not be inspected.
  Location: action sequence dock in the local Workbench.
  Evidence: the in-app browser refused the local Workbench URL under its URL security policy, so no implementation screenshot, focused crop, side-by-side comparison, console check, or browser drag test could be produced.
  Impact: code and build checks pass, but the source-to-render visual match is not independently confirmed.
  Fix: open the already-running local Workbench in an allowed browser session, capture the expanded six-action state, compare it beside the source image, then resolve any P0/P1/P2 differences.

## Comparison history

- Initial pass: blocked before visual comparison; no visual fixes were inferred from code alone.

## Focused region comparison

Not available. The exact action dock crop could not be captured from the rendered implementation.

final result: blocked

---

# Cinematic Morph inspector fidelity QA

- Source visual truth: `/Users/zz41354899/.codex/generated_images/01a0438d-843b-7511-8ece-b476166443f5/exec-7b76ec6d-7866-468e-b6e0-29af1031c9a1.png`
- Source pixels: 837 × 1879
- Implementation screenshot: `/private/tmp/open-slidex-morph-final.png`
- Side-by-side comparison: `/private/tmp/open-slidex-morph-final-comparison.png`
- Browser viewport: 1280 × 1100 CSS px at device scale factor 1
- Compared component size: 345 × 774 CSS px
- Density normalization: source resized proportionally to 345 × 775; implementation captured at 345 × 774
- State: Traditional Chinese, dark theme, four-slide Morph sequence, Spring selected, advanced sequence closed

## Required fidelity surfaces

- Fonts and typography: Workbench Roboto and system CJK fallbacks reproduce the compact title, metadata, control, and value hierarchy without wrapping or truncation. The duration value renders fully as `0.72 秒`.
- Spacing and layout rhythm: the final card is 345 × 774, within one pixel of the normalized 345 × 775 source. Header, preview, settings, curve, range, toggle, summary, and primary action align to the same vertical bands and inset widths.
- Colors and visual tokens: near-black surfaces, low-opacity dividers, violet active states, thumbnail outlines, and the purple primary action match the source balance and contrast.
- Image quality and asset fidelity: source and target remain real editable slide thumbnails. The connector uses a dedicated 960 × 633 WebP plate derived for this UI, with no text or controls baked into it, so the labels, count, thumbnails, and replay control remain live.
- Copy and content: visible labels match the selected Traditional Chinese source, including `Morph 序列`, `開始`, `結束`, `動態手感`, `持續時間`, `形狀柔化`, `淡化未配對內容`, and `預覽效果`.

## Full-view and focused comparison evidence

The target is a single inspector component, so the normalized 345 px component comparison is both the full-view and focused evidence. It preserves readable typography and every visible control while avoiding unrelated editor chrome.

## Comparison history

- Pass 1: found P2 vertical-density drift (847 px implementation versus 775 px normalized source), oversized replay control, and oversized preview thumbnails. Reduced the card to 778 px and corrected preview proportions.
- Pass 2: found P2 inner-width drift, browser number-stepper clipping, wrong closed-summary arrow direction, and excess control-row height. Corrected the 301 px inner control width, duration field, disclosure icon, compact rows, and primary button.
- Pass 3: final implementation is 345 × 774 with no remaining P0, P1, or P2 differences. The fresh editor tab reports no browser errors or warnings.

## Functional verification

- Morph replay is visible, enabled, and opens the existing canvas Morph preview.
- Spring selection is persisted as `morphEasing="spring"` in the active deck.
- 23 focused Workbench interaction and Morph preview tests pass.
- Production runtime build passes and bundles the connector asset as an 8.18 kB WebP.

## Findings

No actionable P0, P1, or P2 fidelity issues remain.

## Follow-up polish

No P3 follow-up is required for this selected state.

final result: passed

---

# Local Workbench top toolbar design QA

- Source visual truth: `/var/folders/fp/bv98vn2s2v9dchl651zpsvn00000gn/T/TemporaryItems/NSIRD_screencaptureui_zZgalo/截圖 2026-08-28 下午2.01.50.png`
- Source pixels: 1918 × 60
- Implementation screenshot: `/private/tmp/toolbar-audit-02-revised.png`
- Implementation pixels: 1918 × 64
- Side-by-side comparison: `/private/tmp/open-slidex-toolbar-comparison-final.png`
- Browser viewport: 1918 × 946 CSS px at device scale factor 1
- Density normalization: the 1918 × 60 source was vertically padded to 1918 × 64 before stacking it above the 1918 × 64 implementation; no scaling was applied
- State: Traditional Chinese, dark theme, `介紹銀河系` open, export menu closed

## Required fidelity surfaces

- Fonts and typography: the existing Roboto and Noto Sans TC stack remains unchanged. The insertion tools use 13 px, 560-weight labels beneath 20 px icons with no wrapping or truncation; document, zoom, play, and export labels retain their established hierarchy.
- Spacing and layout rhythm: the toolbar remains one 64 px row. The five insertion controls form a 300 px borderless group with equal 60 × 54 px hit areas, consistent 2 px gaps, and 4 px icon-to-label spacing. At 1280 px, the brand, insert group, and export control do not overlap.
- Colors and visual tokens: the existing charcoal header, neutral text, subtle hover surfaces, lavender accent, and white export action are preserved. No new framed island or decorative surface was introduced.
- Image quality and asset fidelity: the existing SlideX wordmark is preserved as its source image. All interface symbols continue to use the project's Lucide icon system; the local header no longer exposes a detached replay glyph that could be mistaken for Undo or Redo.
- Copy and content: all primary top-level actions and Traditional Chinese labels remain present. Undo and Redo each appear exactly once. Replay remains available inside the motion and Morph workflows instead of appearing as an unexplained header icon.

## Full-view and focused comparison evidence

The source and implementation were inspected together in `/private/tmp/open-slidex-toolbar-comparison-final.png`. Because the source target is only the toolbar, the 1918 × 64 toolbar crop is both the full-view and focused-region evidence. The insertion group keeps the source's familiar vertical icon-label structure while increasing icon size, contrast, target size, and rhythm. The detached replay glyph was intentionally removed; brand position, document title, viewport control, Play, and Export remain aligned with the source.

## Comparison history

- Pass 1: the horizontal icon-label treatment made the center group too light and visually unrelated to the rest of the toolbar; changing the duplicate-looking replay arrow to Sparkles left another unexplained standalone icon.
- Pass 2: restored the stronger vertical creation-tool hierarchy with larger icons and equal targets, increased Undo/Redo contrast, and removed the standalone local replay action. The final source/implementation comparison shows no remaining P0, P1, or P2 mismatch.

## Functional verification

- Media, Table, and Shape popovers open successfully from the redesigned center controls.
- Play opens the playback-mode dialog.
- Undo and Redo each render once; no standalone replay control remains in the local header.
- Export opens the format menu and exposes the HTML option without starting a download.
- Browser errors and warnings: none.
- At 1280 px, the three header regions remain non-overlapping; at the existing compact breakpoint below 1120 px, insertion tools remain hidden as designed.
- `npm run build:runtime` passes.
- `git diff --check` passes for the edited toolbar files.

## Findings

No actionable P0, P1, or P2 fidelity or interaction issues remain.

## Follow-up polish

No P3 follow-up is required for the selected wide-desktop state.

final result: passed
