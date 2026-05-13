import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading payouts"
      message="Fetching your payout history and balance."
    />
  );
}
