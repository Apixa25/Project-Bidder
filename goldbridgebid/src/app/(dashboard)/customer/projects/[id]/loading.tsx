import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading project details"
      message="Fetching project info, bids, and files."
    />
  );
}
