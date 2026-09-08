# React presentation contract

Read this file before emitting or repairing OpenSlideX TSX.

## Canonical document

```tsx
import {
  Deck,
  Slide,
  Text,
  definePresentation,
} from "@open-slidex/sdk/react";

export default definePresentation({
  title: "One clear deck",
  component: function Presentation() {
    return (
      <Deck title="One clear deck">
        <Slide id="slide-01" duration={5} canvasWidth={1920} canvasHeight={1080} fontSizeUnit="pt" background="#F7F7F5" theme="light">
          <Text id="slide-01-title" role="title" x={8} y={8} w={84} h={14} fontFamily="Roboto" fontSize={42} fontWeight={700}>One clear claim</Text>
        </Slide>
      </Deck>
    );
  },
});
```

`presentation.tsx` is canonical. One complete Deck contains one or more complete Slides. Values used by Canvas and Inspector must be literal and serializable. Visual editing may rewrite literal props; computed expressions stay code-only.

## Native layers

| React component | Purpose |
| --- | --- |
| `Text` | Titles, body, labels, numerals |
| `Image` | Portable still images |
| `Video` | Portable video |
| `Svg` | Declarative shared SVG scenes |
| `Chart` | Quantitative comparison or trend |
| `Table` | Exact values or structured comparison |
| `Shape` | Fields, rules, lines, highlights |
| `HtmlEmbed` | Controlled imported HTML only |

Every visible layer needs unique `id`, `x`, `y`, `w`, and `h`. Shared `groupId` values group native children without a wrapper element. Use `<Text role="title">` for slide titles.

## Local components

```tsx
import { Shape, Text, defineSlideXComponent } from "@open-slidex/sdk/react";

export const Hero = defineSlideXComponent({
  name: "Hero",
  props: {
    eyebrow: { type: "string", required: true },
    title: { type: "string", required: true },
  },
  assetReferences: () => [],
  toMotionDoc: ({ eyebrow, title }) => (
    <>
      <Text id="hero-eyebrow" x={8} y={12} w={56} h={7} fontSize={14}>{eyebrow}</Text>
      <Text id="hero-title" role="title" x={8} y={22} w={70} h={28} fontSize={54}>{title}</Text>
      <Shape id="hero-field" x={76} y={12} w={16} h={76} shape="rectangle" fill="#7C3AED" />
    </>
  ),
  component: ({ eyebrow, title }) => (
    <>
      <Text id="hero-eyebrow" x={8} y={12} w={56} h={7} fontSize={14}>{eyebrow}</Text>
      <Text id="hero-title" role="title" x={8} y={22} w={70} h={28} fontSize={54}>{title}</Text>
      <Shape id="hero-field" x={76} y={12} w={16} h={76} shape="rectangle" fill="#7C3AED" />
    </>
  ),
});
```

A registered component must declare a stable name, runtime props schema, asset references, and a deterministic `toMotionDoc()` expansion. Stable IDs produced by repeated instances must remain unique; pass an instance prefix when necessary. Re-imported MDX preserves expanded native semantics, not the original component name or program logic.

## Declarative motion

Motion remains serializable props on native elements. Shared Morph uses `slideTransition="morph"` on each source slide plus compatible same-type `sharedId` pairs on adjacent slides. Action Tween and click interaction props use strict versioned JSON strings. Preserve a complete static final frame and never use event handlers or executable animation code.

## Invalid source

External npm imports, Node APIs, external network access, arbitrary HTML, cross-deck paths, dynamic code evaluation, and removed components are invalid. A focused edit returns one complete Slide JSX block. A whole-deck edit returns the complete TSX module.
