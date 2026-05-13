import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading dashboard"
      message="Pulling your estimator activity."
    />
  );
}
