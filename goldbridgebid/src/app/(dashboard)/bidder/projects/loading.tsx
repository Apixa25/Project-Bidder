import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading available projects"
      message="Fetching the latest projects matching your specialties and service areas."
    />
  );
}
