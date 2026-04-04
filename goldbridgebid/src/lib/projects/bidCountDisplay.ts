/**
 * Prefer a live count from a PostgREST `bids(count)` embed; fall back to `projects.bid_count`.
 */
export function bidCountForDisplay(project: {
  bid_count?: number | null;
  bids?: { count: number }[] | null;
}): number {
  const fromRelation = project.bids?.[0]?.count;
  if (typeof fromRelation === "number") return fromRelation;
  return project.bid_count ?? 0;
}
