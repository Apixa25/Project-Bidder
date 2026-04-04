/**
 * Prefer a live count from PostgREST `bids!bids_project_id_fkey(count)` (disambiguates awarded_bid_id FK).
 */
export function bidCountForDisplay(project: {
  bid_count?: number | null;
  bids?: { count: number }[] | null;
}): number {
  const fromRelation = project.bids?.[0]?.count;
  if (typeof fromRelation === "number") return fromRelation;
  return project.bid_count ?? 0;
}
