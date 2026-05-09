"use client";

import { useEffect, useState } from "react";

const PROGRESS_MESSAGES = [
  "Reading your project description…",
  "Analyzing location and timeline…",
  "Identifying the project type…",
  "Checking standard requirements…",
  "Building scope checklist items…",
  "Estimating common work packages…",
  "Generating clarification questions…",
  "Finalizing your scope checklist…",
];

interface AiWorkingOverlayProps {
  visible: boolean;
  title?: string;
}

export default function AiWorkingOverlay({
  visible,
  title = "AI is building your scope",
}: AiWorkingOverlayProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!visible) {
      setMessageIndex(0);
      setElapsed(0);
      return;
    }

    const messageInterval = setInterval(() => {
      setMessageIndex((prev) =>
        prev < PROGRESS_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, 5000);

    const timerInterval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(messageInterval);
      clearInterval(timerInterval);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 flex w-full max-w-md flex-col items-center rounded-2xl bg-white px-8 py-10 shadow-2xl">
        {/* Animated construction worker / AI icon */}
        <div className="relative mb-6">
          <div className="h-24 w-24 animate-pulse rounded-full bg-gradient-to-br from-primary/20 to-primary/5" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="h-14 w-14 animate-bounce text-primary"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Hard hat */}
              <path
                d="M16 28C16 28 18 16 32 16C46 16 48 28 48 28"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M12 28H52"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <rect
                x="14"
                y="28"
                width="36"
                height="4"
                rx="2"
                fill="currentColor"
                opacity="0.3"
              />
              {/* Sparkle left */}
              <path
                d="M10 20L12 18M8 24H10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="animate-ping"
                style={{ animationDuration: "2s" }}
              />
              {/* Sparkle right */}
              <path
                d="M54 20L52 18M56 24H54"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="animate-ping"
                style={{ animationDuration: "2.5s" }}
              />
              {/* Shovel handle */}
              <line
                x1="32"
                y1="36"
                x2="32"
                y2="54"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Shovel blade */}
              <path
                d="M26 54C26 54 28 58 32 58C36 58 38 54 38 54"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="currentColor"
                fillOpacity="0.2"
              />
            </svg>
          </div>
          {/* Spinning ring */}
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" style={{ animationDuration: "3s" }} />
        </div>

        {/* Title */}
        <h3 className="text-center text-lg font-bold text-text-primary">
          {title}
        </h3>

        {/* Progress message */}
        <p className="mt-3 text-center text-sm text-text-secondary transition-opacity duration-500">
          {PROGRESS_MESSAGES[messageIndex]}
        </p>

        {/* Progress bar */}
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dark transition-all duration-1000 ease-out"
            style={{
              width: `${Math.min(95, (messageIndex / (PROGRESS_MESSAGES.length - 1)) * 95 + 5)}%`,
            }}
          />
        </div>

        {/* Timer */}
        <p className="mt-4 text-xs text-text-muted">
          {elapsed < 10
            ? "Just getting started…"
            : elapsed < 30
              ? `Working… ${elapsed}s`
              : elapsed < 60
                ? `Almost there… ${elapsed}s`
                : `Still working… ${elapsed}s — complex projects take longer`}
        </p>

        {/* Reassurance */}
        <p className="mt-2 text-center text-xs text-text-muted">
          Please don&apos;t close this page or click away.
        </p>
      </div>
    </div>
  );
}
