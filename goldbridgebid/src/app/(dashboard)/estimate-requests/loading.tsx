import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading estimate requests"
      message="Fetching your estimate requests."
    />
  );
}
