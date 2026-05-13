import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading package details"
      message="Fetching estimate package details."
    />
  );
}
