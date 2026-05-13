import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading estimate packages"
      message="Browsing available estimate packages."
    />
  );
}
