import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading contractors"
      message="Finding contractors in your area."
    />
  );
}
