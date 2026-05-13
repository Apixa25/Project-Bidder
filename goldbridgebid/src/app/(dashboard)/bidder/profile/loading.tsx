import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading your profile"
      message="Fetching your contractor profile details."
    />
  );
}
