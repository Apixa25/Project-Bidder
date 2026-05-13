import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading package editor"
      message="Preparing the edit form for your package."
    />
  );
}
