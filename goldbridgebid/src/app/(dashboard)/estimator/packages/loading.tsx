import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading packages"
      message="Fetching your estimate packages."
    />
  );
}
