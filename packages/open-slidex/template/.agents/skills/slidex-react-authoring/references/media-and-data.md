# Media and data authoring

Read this file only when the React deck uses media, charts, tables, SVG, or imported data.

- Prefer verified files already under the selected deck's `assets/`.
- Import approved media through `open_slidex_media`; use only returned relative paths.
- Never invent URLs or persist Base64, `blob:`, absolute paths, or cross-deck paths.
- Declare custom-component asset references so validation and portable export can find them.

```tsx
<Image id="cover-image" x={52} y={8} w={40} h={84} src="assets/cover.webp" alt="Descriptive subject" fit="cover" />
<Chart id="adoption-trend" x={9} y={26} w={82} h={54} type="line" data='[{"label":"Q1","value":42},{"label":"Q2","value":58}]' />
<Table id="market-table" x={9} y={28} w={82} h={48} cells="Market|Signal|Owner;North|Rising|Ava" />
```

Use `Svg` only with verified, script-free `assets/*.svg`. Charts preserve supplied numbers exactly and state labels, units, period, and source in nearby Text. Tables are for exact lookup. Keep observed evidence separate from interpretation; never invent a missing datum or asset.
