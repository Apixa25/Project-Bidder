interface ProfileReviewSummaryProps {
  heartCount: number;
  verifiedAverageRating: number | null;
  verifiedReviewCount: number;
  publicReviewCount: number;
}

function formatRating(value: number | null) {
  return value === null ? "New" : value.toFixed(1);
}

export default function ProfileReviewSummary({
  heartCount,
  verifiedAverageRating,
  verifiedReviewCount,
  publicReviewCount,
}: ProfileReviewSummaryProps) {
  const cards = [
    {
      label: "Hearts",
      value: heartCount.toString(),
      help: "Quick trust check",
    },
    {
      label: "Verified Rating",
      value: formatRating(verifiedAverageRating),
      help:
        verifiedReviewCount > 0
          ? `${verifiedReviewCount} verified review${verifiedReviewCount === 1 ? "" : "s"}`
          : "No verified reviews yet",
    },
    {
      label: "Public References",
      value: publicReviewCount.toString(),
      help: "Past clients and community",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-bg-warm px-4 py-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {card.label}
          </p>
          <p className="mt-2 text-2xl font-bold text-text-primary">{card.value}</p>
          <p className="mt-1 text-xs text-text-secondary">{card.help}</p>
        </div>
      ))}
    </div>
  );
}
