import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading bids"
      message="Fetching bids on your projects."
    />
  );
}
