"use client";

// Renders a coloured dot that reflects real backend connectivity.
// Must be a Client Component because it uses useBackendStatus (polling hook).

import { useBackendStatus } from "@/hooks/useBackendStatus";

export default function BackendStatus() {
    const status = useBackendStatus();

    const dotClass =
        status === "checking"
            ? "bg-yellow-500 animate-pulse"
            : status === "online"
              ? "bg-green-500 animate-pulse"
              : "bg-red-500";

    const label =
        status === "checking"
            ? "Checking backend…"
            : status === "online"
              ? "Backend live"
              : "Backend offline";

    return <div className={`h-2 w-2 rounded-full ${dotClass}`} title={label} />;
}
