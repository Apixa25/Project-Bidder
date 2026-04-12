const DANGEROUS_PATTERN =
  /<script[\s>]|on\w+\s*=|javascript:/gi;

function sanitize(html: string): string {
  return html.replace(DANGEROUS_PATTERN, "");
}

function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
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
