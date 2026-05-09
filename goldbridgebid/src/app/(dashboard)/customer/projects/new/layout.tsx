/**
 * AI Scope Check runs two parallel OpenAI calls from a server action.
 * Vercel/Next need a generous ceiling so production matches local runtime.
 */
export const maxDuration = 300;

export default function NewProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
