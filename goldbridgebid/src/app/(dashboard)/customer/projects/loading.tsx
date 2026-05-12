import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading your projects"
      message="Fetching your project list and latest activity."
    />
  );
}
