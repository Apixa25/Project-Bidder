const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "a",
  "span",
  "code",
  "pre",
]);

const DROP_WITH_CONTENT =
  /<(script|style|iframe|object|embed|svg|math|noscript|form)\b[^>]*>[\s\S]*?<\/\1>/gi;

const COLOR_VALUE =
  /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)|[a-z]{3,20})$/i;

function safeHref(value: string) {
  const href = value.trim();
  if (/^(https?:|mailto:)/i.test(href)) return href;
  return null;
}

function safeColorStyle(attrs: string) {
  const match = attrs.match(/style\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const style = match?.[1] || match?.[2] || "";
  const color = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1]?.trim() || "";
  if (!COLOR_VALUE.test(color)) return "";
  return ` style="color: ${color}"`;
}

function safeAnchor(attrs: string) {
  const match = attrs.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
  const href = safeHref(match?.[1] || match?.[2] || match?.[3] || "");
  if (!href) return "<a>";
  return `<a href="${href.replace(/"/g, "")}" rel="noopener noreferrer">`;
}

/**
 * Keep the small set of tags the rich-text editor emits.
 * Every other tag, and every attribute except a safe link or color, is dropped.
 */
export function sanitizeRichText(html: string): string {
  const withoutDangerousBlocks = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(DROP_WITH_CONTENT, "")
    .replace(
      /<(script|style|iframe|object|embed|svg|math|noscript|form)\b[^>]*\/?>/gi,
      ""
    );

  return withoutDangerousBlocks.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
    (match, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (match.startsWith("</")) return `</${tag}>`;
      if (tag === "br") return "<br>";
      if (tag === "a") return safeAnchor(rawAttrs);
      if (tag === "span") return `<span${safeColorStyle(rawAttrs)}>`;
      return `<${tag}>`;
    }
  );
}
