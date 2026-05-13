import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading your bids"
      message="Fetching your bid history and status."
    />
  );
}
