"use client";

import { PhoneOff, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTwilio } from "@/context/TwilioContext";
import {
  isUnavailableLikeActivity,
  normalizeWorkerActivityName,
} from "@/lib/worker-status";
import { cn } from "@/lib/utils";

/**
 * Persistent presence warning when the agent is Unavailable or Offline.
 * Renders under the app header so it stays visible across pages.
 */
export default function AvailabilityStatusBanner() {
  const { activityName, toggleActivity, isWorkerReady } = useTwilio();
  const status = normalizeWorkerActivityName(activityName);

  if (!isUnavailableLikeActivity(status)) {
    return null;
  }

  const isOffline = status === "Offline";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "border-b px-4 py-3",
        isOffline
          ? "border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-50"
          : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50"
      )}
    >
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              isOffline ? "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
            )}
            aria-hidden
          >
            {isOffline ? <WifiOff className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">
              {isOffline
                ? "You are Offline — you will not receive any calls"
                : "You are Unavailable — you will not receive any calls"}
            </p>
            <p
              className={cn(
                "mt-0.5 text-sm",
                isOffline
                  ? "text-red-800/90 dark:text-red-100/80"
                  : "text-amber-800/90 dark:text-amber-100/80"
              )}
            >
              Incoming queue calls are paused while your status is {status}. Switch to{" "}
              <span className="font-medium">Available</span> when you are ready to take calls.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className={cn(
            "shrink-0 self-start sm:self-center",
            isOffline
              ? "bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"
              : "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
          )}
          disabled={!isWorkerReady}
          title={!isWorkerReady ? "Connect to Twilio before changing status" : undefined}
          onClick={() => toggleActivity("Available")}
        >
          Go Available
        </Button>
      </div>
    </div>
  );
}
