export type HtmlAttributeToken = {
  name: string;
  value: string;
  valueFrom: number;
  valueTo: number;
};

export type HtmlTagToken = {
  attributes: HtmlAttributeToken[];
  from: number;
  name: string;
  to: number;
};

export type HtmlRawTextToken = {
  from: number;
  name: string;
  to: number;
};

export type HtmlDocumentScan = {
  rawText: HtmlRawTextToken[];
  tags: HtmlTagToken[];
};

export type CssUrlToken = {
  from: number;
  to: number;
  value: string;
};

const maximumHtmlTags = 200_000;
const maximumHtmlAttributes = 1_000_000;
const rawTextTags = new Set(["script", "style", "textarea", "title"]);

/**
 * Scans HTML tags and attributes once without executing or normalizing the
 * document. Raw script-like text is skipped so strings inside scripts cannot
 * become resource references.
 */
export function scanHtmlDocument(source: string): HtmlDocumentScan {
  const tags: HtmlTagToken[] = [];
  const rawText: HtmlRawTextToken[] = [];
  let attributeCount = 0;
  let cursor = 0;

  while (cursor < source.length) {
    const from = source.indexOf("<", cursor);
    if (from < 0) break;
    if (source.startsWith("<!--", from)) {
      cursor = endAfter(source, "-->", from + 4);
      continue;
    }
    if (source.startsWith("<![CDATA[", from)) {
      cursor = endAfter(source, "]]>", from + 9);
      continue;
    }
    if (source[from + 1] === "!" || source[from + 1] === "?") {
      const to = htmlTagEnd(source, from + 2);
      if (to < 0) break;
      cursor = to;
      continue;
    }
    if (source[from + 1] === "/") {
      const to = htmlTagEnd(source, from + 2);
      if (to < 0) break;
      cursor = to;
      continue;
    }

    const token = openingTag(source, from);
    if (token === "unterminated") break;
    if (!token) {
      cursor = from + 1;
      continue;
    }
    tags.push(token);
    attributeCount += token.attributes.length;
    if (tags.length > maximumHtmlTags || attributeCount > maximumHtmlAttributes) {
      throw badRequest("The HTML import contains too many tags or attributes.");
    }
    cursor = token.to;

    if (rawTextTags.has(token.name)) {
      const closing = rawTextClosing(source, cursor, token.name);
      const textTo = closing?.from ?? source.length;
      if (token.name === "style") rawText.push({ from: cursor, name: token.name, to: textTo });
      cursor = closing?.to ?? source.length;
    }
  }

  return { rawText, tags };
}

export function htmlAttributeToken(tag: HtmlTagToken, name: string) {
  const normalized = name.toLowerCase();
  return tag.attributes.find((attribute) => attribute.name === normalized);
}

/** Returns CSS url() value spans in one forward pass. */
export function scanCssUrls(source: string, offset = 0): CssUrlToken[] {
  const tokens: CssUrlToken[] = [];
  const pattern = /\burl\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    let cursor = (match.index ?? 0) + match[0].length;
    while (cursor < source.length && isWhitespace(source[cursor])) cursor += 1;
    const quote = source[cursor] === "\"" || source[cursor] === "'" ? source[cursor++]! : "";
    const valueFrom = cursor;
    if (quote) {
      while (cursor < source.length && source[cursor] !== quote) cursor += 1;
      if (cursor >= source.length) continue;
      const valueTo = cursor;
      cursor += 1;
      while (cursor < source.length && isWhitespace(source[cursor])) cursor += 1;
      if (source[cursor] !== ")") continue;
      tokens.push({ from: offset + valueFrom, to: offset + valueTo, value: source.slice(valueFrom, valueTo) });
      pattern.lastIndex = cursor + 1;
      continue;
    }
    while (cursor < source.length && source[cursor] !== ")") cursor += 1;
    if (cursor >= source.length) continue;
    let valueTo = cursor;
    while (valueTo > valueFrom && isWhitespace(source[valueTo - 1])) valueTo -= 1;
    tokens.push({ from: offset + valueFrom, to: offset + valueTo, value: source.slice(valueFrom, valueTo) });
    pattern.lastIndex = cursor + 1;
  }
  return tokens;
}

function openingTag(source: string, from: number): HtmlTagToken | "unterminated" | null {
  let cursor = from + 1;
  if (!isAsciiLetter(source[cursor])) return null;
  const nameFrom = cursor;
  cursor += 1;
  while (cursor < source.length && isTagNameCharacter(source[cursor])) cursor += 1;
  const name = source.slice(nameFrom, cursor).toLowerCase();
  const attributes: HtmlAttributeToken[] = [];

  while (cursor < source.length) {
    while (cursor < source.length && isWhitespace(source[cursor])) cursor += 1;
    if (source[cursor] === ">") return { attributes, from, name, to: cursor + 1 };
    if (source[cursor] === "/" && source[cursor + 1] === ">") return { attributes, from, name, to: cursor + 2 };
    if (cursor >= source.length) return "unterminated";

    const attributeFrom = cursor;
    while (
      cursor < source.length
      && !isWhitespace(source[cursor])
      && source[cursor] !== "="
      && source[cursor] !== ">"
      && source[cursor] !== "/"
    ) cursor += 1;
    if (cursor === attributeFrom) {
      cursor += 1;
      continue;
    }
    const attributeName = source.slice(attributeFrom, cursor).toLowerCase();
    while (cursor < source.length && isWhitespace(source[cursor])) cursor += 1;
    if (source[cursor] !== "=") {
      attributes.push({ name: attributeName, value: "", valueFrom: cursor, valueTo: cursor });
      continue;
    }
    cursor += 1;
    while (cursor < source.length && isWhitespace(source[cursor])) cursor += 1;
    const quote = source[cursor] === "\"" || source[cursor] === "'" ? source[cursor++]! : "";
    const valueFrom = cursor;
    if (quote) {
      while (cursor < source.length && source[cursor] !== quote) cursor += 1;
      if (cursor >= source.length) return "unterminated";
      attributes.push({ name: attributeName, value: source.slice(valueFrom, cursor), valueFrom, valueTo: cursor });
      cursor += 1;
      continue;
    }
    while (
      cursor < source.length
      && !isWhitespace(source[cursor])
      && source[cursor] !== ">"
      && source[cursor] !== "`"
    ) cursor += 1;
    attributes.push({ name: attributeName, value: source.slice(valueFrom, cursor), valueFrom, valueTo: cursor });
  }
  return "unterminated";
}

function rawTextClosing(source: string, from: number, name: string) {
  let cursor = from;
  while (cursor < source.length) {
    const candidate = source.indexOf("</", cursor);
    if (candidate < 0) return undefined;
    let nameCursor = candidate + 2;
    let matches = true;
    for (let index = 0; index < name.length; index += 1) {
      if (source[nameCursor + index]?.toLowerCase() !== name[index]) {
        matches = false;
        break;
      }
    }
    nameCursor += name.length;
    if (matches && (source[nameCursor] === ">" || isWhitespace(source[nameCursor]))) {
      const to = htmlTagEnd(source, nameCursor);
      if (to < 0) return undefined;
      return { from: candidate, to };
    }
    cursor = candidate + 2;
  }
  return undefined;
}

function htmlTagEnd(source: string, from: number) {
  let quote = "";
  for (let cursor = from; cursor < source.length; cursor += 1) {
    const character = source[cursor] ?? "";
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'") quote = character;
    else if (character === ">") return cursor + 1;
  }
  return -1;
}

function endAfter(source: string, marker: string, from: number) {
  const index = source.indexOf(marker, from);
  return index < 0 ? source.length : index + marker.length;
}

function isAsciiLetter(value: string | undefined) {
  return Boolean(value && /[A-Za-z]/.test(value));
}

function isTagNameCharacter(value: string | undefined) {
  return Boolean(value && /[A-Za-z0-9:_-]/.test(value));
}

function isWhitespace(value: string | undefined) {
  return value === " " || value === "\n" || value === "\r" || value === "\t" || value === "\f";
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}
