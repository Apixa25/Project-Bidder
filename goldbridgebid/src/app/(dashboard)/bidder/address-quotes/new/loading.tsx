import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading quote form"
      message="Setting up the address quote form."
    />
  );
}
