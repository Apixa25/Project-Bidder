import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading purchases"
      message="Fetching your estimate package purchases."
    />
  );
}
