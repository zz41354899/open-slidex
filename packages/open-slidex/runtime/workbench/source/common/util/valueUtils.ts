export function stringValue(value: string | number | undefined) {
  return typeof value === "string" ? value : undefined;
}
