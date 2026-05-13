import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading credentials"
      message="Fetching your licenses and certifications."
    />
  );
}
