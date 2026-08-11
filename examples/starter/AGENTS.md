# OpenSlideX MDX-first Local Workbench

This project contains one presentation source: `presentation.mdx`.

- Read the complete source before changing it.
- Keep every visible object as a native MotionDoc MDX layer.
- Use `<Group>` only for readable layer organization. There is no component
  registry and no `component.insert` command.
- The Workbench runtime is infrastructure only. Use the built-in, serializable
  MotionDoc JSX components; do not add imports, scripts, JavaScript expressions,
  or unregistered runtime components to `presentation.mdx`.
- `<Notes>...</Notes>` is the only non-visual reserved element. It accepts
  CommonMark and becomes Presenter and PowerPoint speaker notes.
- Use the official `open-slidex mcp` server; do not add another MCP server or a
  second persisted canvas state.
- When the user refers to this slide or this layer, read
  `.open-slidex/current.json` immediately before editing.
- Prefer assets already present in `assets/`. Never invent media URLs.
- Run `npm run validate` after source changes.
- Run `npm run render`, inspect `dist/montage.png`, then render and inspect each
  materially changed slide before reporting completion.
- Keep unrelated workspace files unchanged.

Apply the project-local skills in this order for a full creation or redesign:

1. `slidex-mdx-authoring`
2. `slidex-deck-design`
3. `slidex-motion-direction`
4. `slidex-deck-qa`
