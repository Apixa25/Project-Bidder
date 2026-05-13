import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading address quotes"
      message="Fetching your submitted quotes."
    />
  );
}
