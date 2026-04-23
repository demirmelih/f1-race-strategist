// Centralised API client for the F1 Race Strategist backend.
// All fetch calls go through here — no raw URLs in page components.

import { API_BASE } from "@/lib/constants";
import type { Race, TelemetryPoint } from "@/types";

export async function getRaces(): Promise<Race[]> {
    try {
        const res = await fetch(`${API_BASE}/api/races`, { cache: "no-store" });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}

export async function getRace(id: string | number): Promise<Race | null> {
    try {
        const res = await fetch(`${API_BASE}/api/races/${id}`, { cache: "no-store" });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export async function getFastestTelemetry(
    raceId: string | number
): Promise<TelemetryPoint[]> {
    try {
        const res = await fetch(`${API_BASE}/api/telemetry/fastest/${raceId}`, {
            cache: "no-store",
        });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}

export async function getFullRaceTelemetry(
    raceId: string | number
): Promise<TelemetryPoint[]> {
    try {
        const res = await fetch(`${API_BASE}/api/telemetry/full_race/${raceId}`, {
            cache: "no-store",
        });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}
