import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading address details"
      message="Fetching property info and quotes."
    />
  );
}
