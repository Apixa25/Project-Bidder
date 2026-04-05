"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";

export default function PushNotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if ("Notification" in window && "serviceWorker" in navigator) {
      setSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  async function handleEnable() {
    setRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
    } catch {
      console.warn("Push notification permission request failed");
    }
    setRequesting(false);
  }

  if (!supported) {
    return (
      <div className="rounded-lg border border-border bg-bg-warm p-4">
        <p className="text-sm text-text-muted">
          Push notifications are not supported in this browser.
        </p>
      </div>
    );
  }

  if (permission === "granted") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
        <Bell className="h-5 w-5 text-green-600" />
        <div>
          <p className="text-sm font-medium text-green-800">
            Push notifications are enabled
          </p>
          <p className="text-xs text-green-700">
            You'll receive browser notifications for new bids, messages, and
            project updates even when the tab is in the background.
          </p>
        </div>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <BellOff className="h-5 w-5 text-red-500" />
        <div>
          <p className="text-sm font-medium text-red-800">
            Push notifications are blocked
          </p>
          <p className="text-xs text-red-700">
            You'll need to enable notifications in your browser settings for
            this site.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-warm p-4">
      <Bell className="h-5 w-5 text-text-muted" />
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">
          Enable push notifications
        </p>
        <p className="text-xs text-text-muted">
          Get notified about new bids, messages, and project updates in real
          time.
        </p>
      </div>
      <button
        onClick={handleEnable}
        disabled={requesting}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {requesting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Enable"
        )}
      </button>
    </div>
  );
}
