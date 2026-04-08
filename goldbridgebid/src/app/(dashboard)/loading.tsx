import RouteLoadingState from "@/components/loading/RouteLoadingState";

export default function Loading() {
  return (
    <RouteLoadingState
      compact
      title="Loading your dashboard"
      message="We are gathering the latest project, bid, message, and notification data now."
    />
  );
}
