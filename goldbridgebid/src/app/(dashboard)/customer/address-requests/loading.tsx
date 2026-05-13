import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading quote requests"
      message="Fetching your address quote requests."
    />
  );
}
