import {
  MOTION_DOC_CLIPBOARD_FORMAT,
  motionDocClipboardHtml,
  motionDocClipboardPacketFromHtml,
  parseMotionDocClipboardPacket,
  serializeMotionDocClipboardPacket,
  type MotionDocClipboardPacket
} from "@/core/motion-doc/application/motionDocClipboard";

export function writeMotionDocClipboardData(data: DataTransfer, packet: MotionDocClipboardPacket) {
  const serialized = serializeMotionDocClipboardPacket(packet);
  try {
    data.setData(MOTION_DOC_CLIPBOARD_FORMAT, serialized);
  } catch {
    // Some browsers reject custom MIME types. HTML and plain text remain portable fallbacks.
  }
  data.setData("text/html", motionDocClipboardHtml(packet));
  data.setData("text/plain", serialized);
}

export function readMotionDocClipboardData(data: DataTransfer | null | undefined) {
  if (!data) return null;
  return parseMotionDocClipboardPacket(data.getData(MOTION_DOC_CLIPBOARD_FORMAT))
    ?? motionDocClipboardPacketFromHtml(data.getData("text/html"))
    ?? parseMotionDocClipboardPacket(data.getData("text/plain"));
}

export async function writeMotionDocSystemClipboard(packet: MotionDocClipboardPacket) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  const serialized = serializeMotionDocClipboardPacket(packet);
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([motionDocClipboardHtml(packet)], { type: "text/html" }),
        "text/plain": new Blob([serialized], { type: "text/plain" })
      })]);
    } else {
      await navigator.clipboard.writeText(serialized);
    }
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(serialized);
      return true;
    } catch {
      return false;
    }
  }
}

export async function readMotionDocSystemClipboard() {
  if (typeof navigator === "undefined" || !navigator.clipboard) return null;
  try {
    if (navigator.clipboard.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes("text/html")) {
          const html = await (await item.getType("text/html")).text();
          const packet = motionDocClipboardPacketFromHtml(html);
          if (packet) return packet;
        }
        if (item.types.includes("text/plain")) {
          const text = await (await item.getType("text/plain")).text();
          const packet = parseMotionDocClipboardPacket(text);
          if (packet) return packet;
        }
      }
    }
    return parseMotionDocClipboardPacket(await navigator.clipboard.readText());
  } catch {
    return null;
  }
}
