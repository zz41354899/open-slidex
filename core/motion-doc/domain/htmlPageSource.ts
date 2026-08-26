export type HtmlPageSourceLocation = {
  from: number;
  id?: string;
  line: number;
  outerTo: number;
  page: number;
  stage?: number;
  tagName: string;
  /** End of the opening tag. */
  to: number;
};

export type HtmlPageSourceSelection = HtmlPageSourceLocation & {
  fullDocument: boolean;
  source: string;
};

type HtmlTagToken = {
  attributes: string;
  closing: boolean;
  from: number;
  name: string;
  selfClosing: boolean;
  to: number;
};

type OpenHtmlElement = {
  name: string;
  page?: HtmlPageSourceLocation;
};

const rawTextTags = new Set(["iframe", "noembed", "noframes", "script", "style", "textarea", "title", "xmp"]);
const voidTags = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"
]);

/**
 * Locates presentation-page elements without normalizing or rewriting the
 * imported document. The scanner skips comments and raw script/style text,
 * then pairs each page opening tag with its exact closing-tag boundary.
 */
export function htmlPageSourceLocations(source: string): HtmlPageSourceLocation[] {
  const pages: HtmlPageSourceLocation[] = [];
  const genericSlides: HtmlPageSourceLocation[] = [];
  const stack: OpenHtmlElement[] = [];
  let cursor = 0;
  let scannedTo = 0;
  let line = 1;

  while (cursor < source.length) {
    const from = source.indexOf("<", cursor);
    if (from < 0) break;
    line += newlineCount(source, scannedTo, from);
    scannedTo = from;

    if (source.startsWith("<!--", from)) {
      cursor = endAfter(source, "-->", from + 4);
      continue;
    }
    if (source.startsWith("<![CDATA[", from)) {
      cursor = endAfter(source, "]]>", from + 9);
      continue;
    }
    if (source[from + 1] === "!" || source[from + 1] === "?") {
      cursor = htmlTagEnd(source, from + 2);
      continue;
    }

    const token = htmlTagToken(source, from);
    if (!token) {
      cursor = from + 1;
      continue;
    }

    if (token.closing) {
      const openIndex = findOpenElement(stack, token.name);
      if (openIndex >= 0) {
        const closed = stack.splice(openIndex);
        closed.forEach((element) => {
          if (element.page) element.page.outerTo = token.to;
        });
      }
      cursor = token.to;
      continue;
    }

    const explicitPage = htmlAttribute(token.attributes, "data-slidex-page");
    const nativeSlideIndex = htmlAttribute(token.attributes, "data-slidex-slide-index");
    const classes = new Set((htmlAttribute(token.attributes, "class") ?? "").split(/\s+/).filter(Boolean));
    const isGammaPage = classes.has("gcard") && classes.has("page");
    const isNativeSlide = classes.has("slide") && nativeSlideIndex !== undefined;
    const isGenericSlide = classes.has("slide") && !isNativeSlide && !isGammaPage && explicitPage === undefined;
    let pageRecord: HtmlPageSourceLocation | undefined;

    if (explicitPage !== undefined || isGammaPage || isNativeSlide || isGenericSlide) {
      const target = isGenericSlide ? genericSlides : pages;
      const requestedPage = explicitPage !== undefined
        ? Number(explicitPage)
        : isNativeSlide
          ? Number(nativeSlideIndex) + 1
          : target.length + 1;
      const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : target.length + 1;
      const requestedStage = Number(htmlAttribute(token.attributes, "data-stage"));
      const id = htmlAttribute(token.attributes, "id");
      pageRecord = {
        from: token.from,
        ...(id ? { id } : {}),
        line,
        outerTo: token.to,
        page,
        ...(Number.isFinite(requestedStage) && requestedStage >= 0 ? { stage: requestedStage } : {}),
        tagName: token.name,
        to: token.to
      };
      if (target.length < 200) target.push(pageRecord);
    }

    if (!token.selfClosing && !voidTags.has(token.name)) {
      stack.push({ name: token.name, ...(pageRecord ? { page: pageRecord } : {}) });
    }

    if (!token.selfClosing && rawTextTags.has(token.name)) {
      const closing = rawTextClosingOffset(source, token.to, token.name);
      cursor = closing < 0 ? source.length : closing;
    } else {
      cursor = token.to;
    }
  }

  // A plain `.slide` shell is the common fallback used by exported HTML decks.
  // Prefer stronger page declarations whenever the document supplies them so
  // nested decorative `.slide` elements cannot inflate the deck page count.
  return pages.length ? pages : genericSlides;
}

/** Returns exactly the selected page element, or the whole document for a one-page HTML file. */
export function htmlPageSourceSelection(source: string, requestedPage: number): HtmlPageSourceSelection | null {
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const locations = htmlPageSourceLocations(source);
  const location = locations.find((candidate) => candidate.page === page) ?? locations[page - 1];
  if (location) {
    return {
      ...location,
      fullDocument: false,
      source: source.slice(location.from, location.outerTo)
    };
  }
  if (page !== 1 || locations.length > 0) return null;
  return {
    from: 0,
    fullDocument: true,
    line: 1,
    outerTo: source.length,
    page: 1,
    source,
    tagName: "html",
    to: 0
  };
}

export function replaceHtmlSourceRange(
  source: string,
  range: Pick<HtmlPageSourceSelection, "from" | "outerTo">,
  replacement: string
) {
  if (
    !Number.isInteger(range.from)
    || !Number.isInteger(range.outerTo)
    || range.from < 0
    || range.outerTo < range.from
    || range.outerTo > source.length
  ) {
    throw new Error("The HTML page source range is no longer valid.");
  }
  return `${source.slice(0, range.from)}${replacement}${source.slice(range.outerTo)}`;
}

function htmlTagToken(source: string, from: number): HtmlTagToken | null {
  let cursor = from + 1;
  let closing = false;
  if (source[cursor] === "/") {
    closing = true;
    cursor += 1;
  }
  const nameMatch = source.slice(cursor).match(/^[A-Za-z][\w:-]*/);
  if (!nameMatch) return null;
  const name = nameMatch[0].toLowerCase();
  cursor += nameMatch[0].length;
  const attributesFrom = cursor;
  const to = htmlTagEnd(source, cursor);
  if (to <= cursor || source[to - 1] !== ">") return null;
  const beforeClose = source.slice(attributesFrom, to - 1);
  return {
    attributes: beforeClose,
    closing,
    from,
    name,
    selfClosing: !closing && /\/\s*$/.test(beforeClose),
    to
  };
}

function htmlTagEnd(source: string, from: number) {
  let quote = "";
  for (let cursor = from; cursor < source.length; cursor += 1) {
    const character = source[cursor] ?? "";
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") return cursor + 1;
  }
  return source.length;
}

function rawTextClosingOffset(source: string, from: number, tagName: string) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`</${escaped}\\s*>`, "i").exec(source.slice(from));
  return match?.index === undefined ? -1 : from + match.index;
}

function findOpenElement(stack: OpenHtmlElement[], tagName: string) {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index]?.name === tagName) return index;
  }
  return -1;
}

function htmlAttribute(attributes: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = attributes.match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\u0060]+))`, "i"));
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : undefined;
}

function endAfter(source: string, marker: string, from: number) {
  const index = source.indexOf(marker, from);
  return index < 0 ? source.length : index + marker.length;
}

function newlineCount(source: string, from: number, to: number) {
  let count = 0;
  for (let index = from; index < to; index += 1) {
    if (source.charCodeAt(index) === 10) count += 1;
  }
  return count;
}
