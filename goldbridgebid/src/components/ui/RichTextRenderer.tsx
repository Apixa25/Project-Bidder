const DANGEROUS_PATTERN =
  /<script[\s>]|on\w+\s*=|javascript:/gi;

function sanitize(html: string): string {
  return html.replace(DANGEROUS_PATTERN, "");
}

function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

/**
 * Convert rich-text HTML produced by the editor into a clean plain-text
 * string suitable for truncated previews (e.g. project list cards).
 * Strips all tags, decodes common HTML entities, and collapses whitespace
 * so `line-clamp` works predictably.
 */
export function stripHtml(content: string | null | undefined): string {
  if (!content) return "";
  if (!looksLikeHtml(content)) return content;

  return content
    // Drop any dangerous markup first.
    .replace(DANGEROUS_PATTERN, "")
    // Convert structural breaks to spaces so words don't run together.
    .replace(/<\/(p|div|li|h[1-6]|br)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    // Strip everything else.
    .replace(/<[^>]+>/g, "")
    // Decode the handful of entities the editor commonly emits.
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    // Collapse runs of whitespace.
    .replace(/\s+/g, " ")
    .trim();
}

interface RichTextRendererProps {
  content: string | null | undefined;
  className?: string;
}

export default function RichTextRenderer({
  content,
  className = "",
}: RichTextRendererProps) {
  if (!content) return null;

  if (!looksLikeHtml(content)) {
    return (
      <p className={`whitespace-pre-wrap leading-relaxed ${className}`}>
        {content}
      </p>
    );
  }

  return (
    <div
      className={`rich-text-display leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitize(content) }}
    />
  );
}
