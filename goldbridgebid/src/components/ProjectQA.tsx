"use client";

import { useState } from "react";
import { MessageCircleQuestion, CheckCircle2, Loader2 } from "lucide-react";
import { askProjectQuestion, answerProjectQuestion } from "@/app/(dashboard)/project-qa-actions";
import ActionPendingOverlay from "@/components/loading/ActionPendingOverlay";

interface Question {
  id: string;
  asker_id: string;
  asker_name: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
}

interface ProjectQAProps {
  projectId: string;
  questions: Question[];
  currentUserId: string;
  isProjectOwner: boolean;
}

export default function ProjectQA({
  projectId,
  questions,
  currentUserId,
  isProjectOwner,
}: ProjectQAProps) {
  const [submitting, setSubmitting] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);

  async function handleAsk(formData: FormData) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setPendingLabel("Submitting your question...");
    const result = await askProjectQuestion(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess("Question submitted!");
      setTimeout(() => setSuccess(null), 3000);
    }
    setPendingLabel(null);
    setSubmitting(false);
  }

  async function handleAnswer(formData: FormData) {
    setAnsweringId(formData.get("questionId") as string);
    setError(null);
    setPendingLabel("Posting your answer...");
    const result = await answerProjectQuestion(formData);
    if (result?.error) {
      setError(result.error);
    }
    setPendingLabel(null);
    setAnsweringId(null);
  }

  return (
    <div className="relative rounded-xl border border-border bg-surface p-6 shadow-sm">
      {(submitting || Boolean(answeringId)) && pendingLabel && (
        <ActionPendingOverlay label={pendingLabel} />
      )}
      <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary mb-1">
        <MessageCircleQuestion className="h-5 w-5" />
        Project Q&A
      </h2>
      <p className="text-sm text-text-muted mb-4">
        {isProjectOwner
          ? "Bidders can ask public questions here. Your answers are visible to all bidders."
          : "Ask questions about this project. The customer's answers are visible to all bidders."}
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}

      {!isProjectOwner && (
        <form action={handleAsk} className="mb-6">
          <input type="hidden" name="projectId" value={projectId} />
          <textarea
            name="question"
            required
            rows={2}
            placeholder="Ask a question about this project..."
            className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Ask Question"
            )}
          </button>
        </form>
      )}

      {questions.length > 0 ? (
        <div className="space-y-4">
          {questions.map((q) => (
            <div
              key={q.id}
              className="rounded-lg border border-border bg-bg-warm p-4"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-xs font-bold text-secondary">
                  Q
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary">{q.question}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    Asked by {q.asker_id === currentUserId ? "you" : q.asker_name} · {new Date(q.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {q.answer ? (
                <div className="mt-3 ml-9 flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    A
                  </span>
                  <div>
                    <p className="text-sm text-text-primary">{q.answer}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      Answered {q.answered_at ? new Date(q.answered_at).toLocaleDateString() : ""}
                    </p>
                  </div>
                </div>
              ) : isProjectOwner ? (
                <form action={handleAnswer} className="mt-3 ml-9">
                  <input type="hidden" name="questionId" value={q.id} />
                  <input type="hidden" name="projectId" value={projectId} />
                  <textarea
                    name="answer"
                    required
                    rows={2}
                    placeholder="Write your answer..."
                    className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="submit"
                    disabled={answeringId === q.id}
                    className="mt-2 flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    {answeringId === q.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Post Answer
                  </button>
                </form>
              ) : (
                <p className="mt-3 ml-9 text-xs text-text-muted italic">
                  Awaiting answer from the project owner
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted">
          No questions yet. {!isProjectOwner && "Be the first to ask!"}
        </p>
      )}
    </div>
  );
}
