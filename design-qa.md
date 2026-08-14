# OpenSlideX editor design QA

## Evidence

- Source visual truth:
  - `/var/folders/fp/bv98vn2s2v9dchl651zpsvn00000gn/T/TemporaryItems/NSIRD_screencaptureui_YOO2ST/截圖 2026-08-14 上午9.41.03.png` (302 × 356 px)
  - `/var/folders/fp/bv98vn2s2v9dchl651zpsvn00000gn/T/TemporaryItems/NSIRD_screencaptureui_JgcxMw/截圖 2026-08-14 上午9.41.16.png` (295 × 378 px)
  - `/var/folders/fp/bv98vn2s2v9dchl651zpsvn00000gn/T/TemporaryItems/NSIRD_screencaptureui_0D6zsJ/截圖 2026-08-14 上午9.43.33.png` (112 × 64 px)
- Browser-rendered implementation:
  - `dist/design-qa/editor-desktop.png` (1440 × 1000 px)
  - `dist/design-qa/editor-shader-dropdown.png` (1440 × 1000 px)
  - `dist/design-qa/editor-transition-grid-fixed.png` (1440 × 1000 px)
  - `dist/design-qa/editor-mobile-390.png` (390 × 844 px)
- CSS viewports and density: desktop 1440 × 1000 at device scale 1; mobile 390 × 844 at device scale 1. The supplied screenshots are focused problem crops, so comparisons used matched component states rather than equal full-page crops.
- State: local Workspace deck editor; slide Inspector open; dynamic background selector open for the menu comparison; transition section scrolled into view for the thumbnail comparison.

## Full-view comparison

The repaired editor keeps the established three-column workflow while moving the shell to a restrained ChatGPT-like neutral palette: `#212121` canvas/header, `#171717` side panels, `#2f2f2f` controls, low-contrast dividers, and a high-contrast neutral export action. The visual hierarchy remains clear at 1440 px and the 390 px layout has no horizontal document overflow.

## Focused-region comparison

- Shader selector: the supplied native macOS menu escaped the Inspector surface and overlapped unrelated controls. The implementation uses a portal-based, width-matched listbox with a bounded height, consistent rows, keyboard semantics, and the same neutral surface as the editor.
- Transition previews: the supplied cards showed each SVG at 16 × 16 px. Browser measurement found the shared toggle selector forcing descendant SVGs to `size-4`. The corrected preview SVG measures 113.5 × 62.97 CSS px inside a 16:9 frame, with readable artwork and labels.
- Return navigation: the supplied control relied on an arrow plus logo only. Desktop now shows `返回工作區`, a divider, and the SlideX wordmark; compact mobile preserves the wordmark and hides only the long label when space is constrained.

## Required fidelity surfaces

- Fonts and typography: existing Geist/system typography is preserved; label weights and 11–14 px Inspector hierarchy remain readable without wrapping regressions.
- Spacing and layout rhythm: 16:9 motion previews, 126 px cards, 8–12 px radii, and consistent panel gutters remove the compressed/uneven states from the supplied captures.
- Colors and visual tokens: the editor shell now uses neutral ChatGPT-like dark grays with subtle white borders; brand purple is limited to presentation/motion content and the SlideX mark.
- Image quality and asset fidelity: the supplied SlideX wordmark asset is retained. No placeholder logo or approximate drawn asset was introduced. Existing native motion previews render sharply at their intended size.
- Copy and content: `返回工作區` makes the return destination explicit. Existing localized transition and shader names remain intact.

## Comparison history

1. Initial findings:
   - P2: native Paper menus were visually detached from the Inspector and could overlap lower controls.
   - P2: transition SVGs were forced to 16 × 16 px by the toggle component's descendant SVG rule.
   - P2: the icon-only return control did not name its destination.
2. Fixes:
   - Replaced the two Paper native selects with a contained accessible Select surface.
   - Added explicit 16:9 preview frames and exempted motion SVGs from the toggle icon-size rule.
   - Added a localized return label, divider, responsive behavior, and neutral hover/focus treatment.
3. Post-fix evidence:
   - The shader menu remains aligned to the 320 px Inspector and exposes listbox/option semantics.
   - Transition preview SVGs measure 113.5 × 62.97 CSS px and are visibly readable.
   - Workspace → editor → return navigation ends at `/workspace` with scroll position 0.
   - At 390 px the document scroll width equals the viewport width; browser console contains no warnings or errors.

## Findings

No actionable P0, P1, or P2 visual differences remain for the supplied issues. The implementation intentionally uses the screenshots as problem evidence, not as a target to preserve the broken sizing or native menu behavior.

## Open questions

None.

## Implementation checklist

- [x] Contained shader and preset menus
- [x] Readable 16:9 transition thumbnails
- [x] Explicit return-to-Workspace control
- [x] Neutral ChatGPT-like editor palette
- [x] Desktop and 390 px responsive browser checks
- [x] Interaction and console verification

## Follow-up polish

No blocking polish items remain.

final result: passed
