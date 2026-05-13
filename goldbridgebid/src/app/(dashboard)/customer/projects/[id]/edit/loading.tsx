import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading project editor"
      message="Preparing the edit form for your project."
    />
  );
}
