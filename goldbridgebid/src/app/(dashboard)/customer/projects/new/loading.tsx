import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading project form"
      message="Setting up the new project page for you."
    />
  );
}
