import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

export type TableSelectionKind = "column" | "row";

export type TableSelection = {
  index: number;
  kind: TableSelectionKind;
};

export type TableClipboard = {
  cells: string[];
  kind: TableSelectionKind;
};

export type TableSize = {
  columns: number;
  rows: number;
};

export const TABLE_MIN_COLUMNS = 1;
export const TABLE_MAX_COLUMNS = 50;
export const TABLE_MIN_ROWS = 1;
export const TABLE_MAX_ROWS = 50;
const TABLE_DEFAULT_TRACK = 1;
const TABLE_MIN_TRACK = 0.28;

const cellColumnSeparator = "|";
const cellRowSeparator = ";";

export function tableSizeFromProps(props: MotionDocProps): TableSize {
  return {
    columns: normalizeTableDimension(props.columns ?? props.cols, 2, TABLE_MIN_COLUMNS, TABLE_MAX_COLUMNS),
    rows: normalizeTableDimension(props.rows, 2, TABLE_MIN_ROWS, TABLE_MAX_ROWS)
  };
}

export function normalizeTableDimension(value: string | number | undefined, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(parsed), min), max);
}

export function tableColumnLabelsFromProps(props: MotionDocProps, columns: number) {
  return normalizeLabels(props.columnLabels, columns, columnLabel);
}

export function tableRowLabelsFromProps(props: MotionDocProps, rows: number) {
  return normalizeLabels(props.rowLabels, rows, (index) => String(index + 1));
}

export function tableCellsFromProps(props: MotionDocProps, rows: number, columns: number) {
  const rawCells = typeof props.cells === "string" ? props.cells : "";
  const parsedRows = parseSerializedCells(rawCells);
  return normalizeTableCells(parsedRows, rows, columns);
}

export function tableColumnTrackValuesFromProps(props: MotionDocProps, columns: number) {
  return normalizeTableTrackValues(parseTableTrackValues(props.columnWidths), columns);
}

export function tableRowTrackValuesFromProps(props: MotionDocProps, rows: number) {
  return normalizeTableTrackValues(parseTableTrackValues(props.rowHeights), rows);
}

export function tableTrackTemplate(values: number[]) {
  return values.map((value) => `${roundTrackValue(Math.max(value, TABLE_MIN_TRACK))}fr`).join(" ");
}

export function updateTableColumnTrackValues(props: MotionDocProps, values: number[]): MotionDocProps {
  const { columns } = tableSizeFromProps(props);
  return {
    ...props,
    columnWidths: serializeTableTrackValues(normalizeTableTrackValues(values, columns))
  };
}

export function updateTableRowTrackValues(props: MotionDocProps, values: number[]): MotionDocProps {
  const { rows } = tableSizeFromProps(props);
  return {
    ...props,
    rowHeights: serializeTableTrackValues(normalizeTableTrackValues(values, rows))
  };
}

export function createTableCells(rows: number, columns: number, fill: (row: number, column: number) => string = () => "") {
  return Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: columns }, (_, columnIndex) => fill(rowIndex, columnIndex))
  );
}

export function serializeTableCells(cells: string[][]) {
  return cells
    .map((row) => row.map(safeTableCellValue).join(cellColumnSeparator))
    .join(cellRowSeparator);
}

export function tableCellsToTsv(cells: string[][]) {
  return cells.map((row) => row.join("\t")).join("\n");
}

export function tableCellsFromTsv(value: string) {
  const rows = value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  return rows.map((row) => row.split("\t").map((cell) => cell.trim()));
}

export function tablePropsFromTsv(props: MotionDocProps, value: string): MotionDocProps {
  const parsedCells = tableCellsFromTsv(value);
  const rows = Math.min(Math.max(parsedCells.length, TABLE_MIN_ROWS), TABLE_MAX_ROWS);
  const columns = Math.min(
    Math.max(parsedCells.reduce((max, row) => Math.max(max, row.length), TABLE_MIN_COLUMNS), TABLE_MIN_COLUMNS),
    TABLE_MAX_COLUMNS
  );
  const cells = normalizeTableCells(parsedCells, rows, columns);

  return withTableSize(props, rows, columns, cells);
}

export function resizeTableProps(props: MotionDocProps, nextRows: number, nextColumns: number): MotionDocProps {
  const currentSize = tableSizeFromProps(props);
  const currentCells = tableCellsFromProps(props, currentSize.rows, currentSize.columns);
  const rows = normalizeTableDimension(nextRows, currentSize.rows, TABLE_MIN_ROWS, TABLE_MAX_ROWS);
  const columns = normalizeTableDimension(nextColumns, currentSize.columns, TABLE_MIN_COLUMNS, TABLE_MAX_COLUMNS);
  const cells = normalizeTableCells(currentCells, rows, columns);

  return withTableSize(props, rows, columns, cells);
}

export function insertTableRow(props: MotionDocProps, rowIndex: number): MotionDocProps {
  const size = tableSizeFromProps(props);

  if (size.rows >= TABLE_MAX_ROWS) {
    return props;
  }

  const cells = tableCellsFromProps(props, size.rows, size.columns);
  const insertIndex = Math.min(Math.max(rowIndex + 1, 0), cells.length);
  const rowHeights = tableRowTrackValuesFromProps(props, size.rows);
  cells.splice(insertIndex, 0, Array.from({ length: size.columns }, () => ""));
  rowHeights.splice(insertIndex, 0, rowHeights[Math.max(0, insertIndex - 1)] ?? TABLE_DEFAULT_TRACK);

  return withTableSize(props, size.rows + 1, size.columns, cells, { rowHeights });
}

export function deleteTableRow(props: MotionDocProps, rowIndex: number): MotionDocProps {
  const size = tableSizeFromProps(props);

  if (size.rows <= TABLE_MIN_ROWS) {
    return props;
  }

  const cells = tableCellsFromProps(props, size.rows, size.columns);
  const deleteIndex = Math.min(Math.max(rowIndex, 0), cells.length - 1);
  const rowHeights = tableRowTrackValuesFromProps(props, size.rows);
  cells.splice(deleteIndex, 1);
  rowHeights.splice(deleteIndex, 1);

  return withTableSize(props, size.rows - 1, size.columns, cells, { rowHeights });
}

export function insertTableColumn(props: MotionDocProps, columnIndex: number): MotionDocProps {
  const size = tableSizeFromProps(props);

  if (size.columns >= TABLE_MAX_COLUMNS) {
    return props;
  }

  const cells = tableCellsFromProps(props, size.rows, size.columns);
  const insertIndex = Math.min(Math.max(columnIndex + 1, 0), size.columns);
  const columnWidths = tableColumnTrackValuesFromProps(props, size.columns);

  for (const row of cells) {
    row.splice(insertIndex, 0, "");
  }
  columnWidths.splice(insertIndex, 0, columnWidths[Math.max(0, insertIndex - 1)] ?? TABLE_DEFAULT_TRACK);

  return withTableSize(props, size.rows, size.columns + 1, cells, { columnWidths });
}

export function deleteTableColumn(props: MotionDocProps, columnIndex: number): MotionDocProps {
  const size = tableSizeFromProps(props);

  if (size.columns <= TABLE_MIN_COLUMNS) {
    return props;
  }

  const cells = tableCellsFromProps(props, size.rows, size.columns);
  const deleteIndex = Math.min(Math.max(columnIndex, 0), size.columns - 1);
  const columnWidths = tableColumnTrackValuesFromProps(props, size.columns);

  for (const row of cells) {
    row.splice(deleteIndex, 1);
  }
  columnWidths.splice(deleteIndex, 1);

  return withTableSize(props, size.rows, size.columns - 1, cells, { columnWidths });
}

export function tableClipboardFromSelection(props: MotionDocProps, selection: TableSelection): TableClipboard {
  const size = tableSizeFromProps(props);
  const cells = tableCellsFromProps(props, size.rows, size.columns);

  if (selection.kind === "row") {
    return {
      cells: [...(cells[selection.index] ?? [])],
      kind: "row"
    };
  }

  return {
    cells: cells.map((row) => row[selection.index] ?? ""),
    kind: "column"
  };
}

export function clearTableSelection(props: MotionDocProps, selection: TableSelection): MotionDocProps {
  const size = tableSizeFromProps(props);
  const cells = tableCellsFromProps(props, size.rows, size.columns);

  if (selection.kind === "row") {
    cells[selection.index] = Array.from({ length: size.columns }, () => "");
  } else {
    for (const row of cells) {
      row[selection.index] = "";
    }
  }

  return withTableSize(props, size.rows, size.columns, cells);
}

export function pasteTableClipboard(props: MotionDocProps, selection: TableSelection, clipboard: TableClipboard): MotionDocProps {
  const size = tableSizeFromProps(props);
  const cells = tableCellsFromProps(props, size.rows, size.columns);

  if (selection.kind === "row") {
    cells[selection.index] = Array.from({ length: size.columns }, (_, index) => clipboard.cells[index] ?? "");
  } else {
    for (let rowIndex = 0; rowIndex < size.rows; rowIndex += 1) {
      cells[rowIndex][selection.index] = clipboard.cells[rowIndex] ?? "";
    }
  }

  return withTableSize(props, size.rows, size.columns, cells);
}

export function updateTableCell(props: MotionDocProps, rowIndex: number, columnIndex: number, value: string): MotionDocProps {
  const size = tableSizeFromProps(props);
  const cells = tableCellsFromProps(props, size.rows, size.columns);

  if (rowIndex < 0 || rowIndex >= size.rows || columnIndex < 0 || columnIndex >= size.columns) {
    return props;
  }

  cells[rowIndex][columnIndex] = value;

  return withTableSize(props, size.rows, size.columns, cells);
}

export function columnLabel(index: number) {
  let value = "";
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }

  return value;
}

function withTableSize(
  props: MotionDocProps,
  rows: number,
  columns: number,
  cells: string[][],
  tracks?: {
    columnWidths?: number[];
    rowHeights?: number[];
  }
): MotionDocProps {
  return {
    ...props,
    cells: serializeTableCells(cells),
    columnLabels: tableColumnLabelsFromProps(props, columns).join(","),
    columnWidths: serializeTableTrackValues(normalizeTableTrackValues(tracks?.columnWidths ?? parseTableTrackValues(props.columnWidths), columns)),
    columns,
    rowHeights: serializeTableTrackValues(normalizeTableTrackValues(tracks?.rowHeights ?? parseTableTrackValues(props.rowHeights), rows)),
    rowLabels: tableRowLabelsFromProps(props, rows).join(","),
    rows
  };
}

function normalizeLabels(value: string | number | undefined, count: number, fallback: (index: number) => string) {
  const labels = typeof value === "string"
    ? value.split(",").map((item) => item.trim())
    : [];

  return Array.from({ length: count }, (_, index) => labels[index] || fallback(index));
}

function parseSerializedCells(value: string) {
  if (!value) {
    return [];
  }

  if (value.includes("\t") || value.includes("\n")) {
    return tableCellsFromTsv(value);
  }

  return value
    .split(cellRowSeparator)
    .map((row) => row.split(cellColumnSeparator).map((cell) => cell.trim()));
}

function normalizeTableCells(cells: string[][], rows: number, columns: number) {
  return Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: columns }, (_, columnIndex) => cells[rowIndex]?.[columnIndex] ?? "")
  );
}

function parseTableTrackValues(value: string | number | undefined) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function normalizeTableTrackValues(values: number[], count: number) {
  return Array.from({ length: count }, (_, index) => Math.max(values[index] ?? TABLE_DEFAULT_TRACK, TABLE_MIN_TRACK));
}

function serializeTableTrackValues(values: number[]) {
  const normalized = values.map((value) => roundTrackValue(Math.max(value, TABLE_MIN_TRACK)));
  const isDefault = normalized.every((value) => Math.abs(value - TABLE_DEFAULT_TRACK) < 0.001);

  return isDefault ? "" : normalized.join(",");
}

function roundTrackValue(value: number) {
  return Math.round(value * 1000) / 1000;
}

function safeTableCellValue(value: string) {
  return value
    .replaceAll("\"", "'")
    .replaceAll(cellColumnSeparator, "/")
    .replaceAll(cellRowSeparator, ",")
    .trim();
}

// ─── Per-row / per-column style overrides ───────────────────────────────

export type CellStyleOverride = {
  background?: string;
  borderColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: "left" | "center" | "right";
  fontFamily?: string;
};

export type StyleOverrides = Record<number, CellStyleOverride>;

export function parseRowOverrides(props: MotionDocProps): StyleOverrides {
  return parseOverridesJson(props.rowOverrides);
}

export function parseColOverrides(props: MotionDocProps): StyleOverrides {
  return parseOverridesJson(props.colOverrides);
}

export function updateRowOverride(props: MotionDocProps, rowIndex: number, patch: CellStyleOverride): MotionDocProps {
  const overrides = parseRowOverrides(props);
  overrides[rowIndex] = { ...overrides[rowIndex], ...patch };
  cleanEmptyOverride(overrides, rowIndex);
  return { ...props, rowOverrides: serializeOverrides(overrides) };
}

export function updateColOverride(props: MotionDocProps, colIndex: number, patch: CellStyleOverride): MotionDocProps {
  const overrides = parseColOverrides(props);
  overrides[colIndex] = { ...overrides[colIndex], ...patch };
  cleanEmptyOverride(overrides, colIndex);
  return { ...props, colOverrides: serializeOverrides(overrides) };
}

export function clearRowOverride(props: MotionDocProps, rowIndex: number): MotionDocProps {
  const overrides = parseRowOverrides(props);
  delete overrides[rowIndex];
  return { ...props, rowOverrides: serializeOverrides(overrides) };
}

export function clearColOverride(props: MotionDocProps, colIndex: number): MotionDocProps {
  const overrides = parseColOverrides(props);
  delete overrides[colIndex];
  return { ...props, colOverrides: serializeOverrides(overrides) };
}

export function serializeOverrides(overrides: StyleOverrides): string {
  const keys = Object.keys(overrides);
  if (keys.length === 0) return "";
  return JSON.stringify(overrides);
}

function parseOverridesJson(value: string | number | undefined): StyleOverrides {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as StyleOverrides;
    }
  } catch {
    // invalid JSON — ignore
  }
  return {};
}

function cleanEmptyOverride(overrides: StyleOverrides, index: number) {
  const entry = overrides[index];
  if (!entry) return;
  const hasValue = Object.values(entry).some((v) => typeof v === "string" && v.trim() !== "");
  if (!hasValue) {
    delete overrides[index];
  }
}
