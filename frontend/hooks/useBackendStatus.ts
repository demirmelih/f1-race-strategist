"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/constants";

export type BackendStatus = "checking" | "online" | "offline";

/**
 * Polls /api/health on mount and every 30 seconds.
 * Returns the current backend connectivity status.
 *
 * Why poll? The status indicator in the nav gives users instant feedback
 * when the backend goes down without requiring a page reload.
 */
export function useBackendStatus(): BackendStatus {
    const [status, setStatus] = useState<BackendStatus>("checking");

    useEffect(() => {
        let cancelled = false;

        async function check() {
            try {
                const res = await fetch(`${API_BASE}/api/health`, {
                    cache: "no-store",
                    signal: AbortSignal.timeout(3000),
                });
                if (!cancelled) setStatus(res.ok ? "online" : "offline");
            } catch {
                if (!cancelled) setStatus("offline");
            }
        }

        check();
        const interval = setInterval(check, 30_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    return status;
}
