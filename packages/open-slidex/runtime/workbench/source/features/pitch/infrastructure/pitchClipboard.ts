export function clipboardImageFile(event: ClipboardEvent) {
  const itemFile = Array.from(event.clipboardData?.items ?? [])
    .find((item) => item.kind === "file" && item.type.startsWith("image/"))
    ?.getAsFile();

  return itemFile ?? Array.from(event.clipboardData?.files ?? [])
    .find((file) => file.type.startsWith("image/")) ?? null;
}
