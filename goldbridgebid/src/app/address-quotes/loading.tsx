import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading address quotes"
      message="Searching available address quotes near you."
    />
  );
}
