"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { buildNormParams, normPoint } from "@/lib/trackMath";
import { useRacePlayback } from "@/hooks/useRacePlayback";
import TrackCanvas from "@/components/track/TrackCanvas";
import type { CarDot } from "@/components/track/TrackCanvas";
import PlaybackControls from "@/components/track/PlaybackControls";
import Leaderboard from "@/components/track/Leaderboard";
import type { LeaderboardEntry } from "@/components/track/Leaderboard";
import { teamColor } from "@/components/track/Leaderboard";
import type { TelemetryPoint } from "@/types";
import { getFullRaceTelemetry } from "@/lib/api";

interface DriverData {
    abbreviation: string;
    team: string;
    color: string;
    frames: TelemetryPoint[];
}

type Mode = "fastest" | "full_race";

interface RaceViewProps {
    fastestData: TelemetryPoint[];
    raceId: string;
}

function groupByDriver(data: TelemetryPoint[]): DriverData[] {
    const map = new Map<string, TelemetryPoint[]>();
    const meta = new Map<string, { team: string }>();
    for (const pt of data) {
        const abbr = pt.driver_abbreviation;
        if (!map.has(abbr)) {
            map.set(abbr, []);
            meta.set(abbr, { team: pt.driver_team });
        }
        map.get(abbr)!.push(pt);
    }
    return Array.from(map.entries()).map(([abbr, frames]) => ({
        abbreviation: abbr,
        team: meta.get(abbr)!.team,
        color: teamColor(meta.get(abbr)!.team),
        frames,
    }));
}

/** Format seconds as M:SS.mmm (e.g. 87.543 → "1:27.543") */
function formatLapTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

function formatGap(seconds: number): string {
    return seconds === 0 ? "—" : `+${seconds.toFixed(3)}`;
}

const SVG_SIZE = 800;
const SVG_PADDING = 40;

export default function RaceView({ fastestData, raceId }: RaceViewProps) {
    const [mode, setMode] = useState<Mode>("fastest");
    const [fullRaceData, setFullRaceData] = useState<TelemetryPoint[]>([]);
    const [isFetchingFull, setIsFetchingFull] = useState(false);
    // useRef so the "already fetched" flag survives re-renders without triggering them
    const fullRaceFetched = useRef(false);

    const handleModeChange = useCallback(
        async (newMode: Mode) => {
            // Switch the tab immediately for instant feedback
            setMode(newMode);
            // Fetch full race data only on first click — then it's cached in state
            if (newMode === "full_race" && !fullRaceFetched.current) {
                setIsFetchingFull(true);
                const data = await getFullRaceTelemetry(raceId);
                setFullRaceData(data);
                fullRaceFetched.current = true;
                setIsFetchingFull(false);
            }
        },
        [raceId]
    );

    const activeData = mode === "fastest" ? fastestData : fullRaceData;
    const drivers = useMemo(() => groupByDriver(activeData), [activeData]);

    const totalFrames = useMemo(
        () => Math.max(1, ...drivers.map((d) => d.frames.length)),
        [drivers]
    );

    const playback = useRacePlayback(totalFrames);

    const trackPoints = useMemo(
        () => (drivers.length > 0 ? drivers[0].frames : []),
        [drivers]
    );

    const normParams = useMemo(
        () => buildNormParams(trackPoints, SVG_SIZE, SVG_PADDING),
        [trackPoints]
    );

    const cars: CarDot[] = useMemo(() => {
        return drivers
            .filter((d) => d.frames.length > 0)
            .map((d) => {
                const idx = Math.min(playback.currentIndex, d.frames.length - 1);
                const pt = d.frames[idx];
                return { pos: normPoint(pt, normParams), color: d.color, label: d.abbreviation };
            });
    }, [drivers, playback.currentIndex, normParams]);

    const leaderboard: LeaderboardEntry[] = useMemo(() => {
        const entries = drivers
            .filter((d) => d.frames.length > 0)
            .map((d) => {
                const idx = Math.min(playback.currentIndex, d.frames.length - 1);
                const pt = d.frames[idx];
                // Total lap duration = session_time of the last frame.
                // For fastest lap mode session_time is lap-relative (starts at 0),
                // so the final value IS the lap time in seconds.
                const lapTime =
                    mode === "fastest"
                        ? d.frames[d.frames.length - 1].session_time
                        : undefined;
                return {
                    abbreviation: d.abbreviation,
                    team: d.team,
                    speed: pt.speed,
                    gear: pt.gear,
                    color: d.color,
                    totalDistance: pt.total_distance,
                    lapNumber: pt.lap_number,
                    lapTime,
                    gapToLeader: 0,
                    position: 0,
                };
            });

        if (mode === "fastest") {
            // Sort by total lap time ascending — fastest driver is P1
            entries.sort((a, b) => (a.lapTime ?? 0) - (b.lapTime ?? 0));
            const leaderTime = entries[0]?.lapTime ?? 0;
            entries.forEach((e, i) => {
                e.position = i + 1;
                e.gapToLeader = (e.lapTime ?? 0) - leaderTime;
            });
        } else {
            // F1 race position algorithm:
            //   1. Driver on the highest lap number is furthest ahead
            //   2. Among drivers on the same lap, whoever has covered more distance is ahead
            // total_distance resets to 0 each lap (it's distance within the current lap),
            // so we MUST use lap_number as the primary sort key — distance alone is wrong.
            entries.sort((a, b) => {
                const lapDiff = (b.lapNumber ?? 0) - (a.lapNumber ?? 0);
                if (lapDiff !== 0) return lapDiff;
                return b.totalDistance - a.totalDistance;
            });
            entries.forEach((e, i) => (e.position = i + 1));
        }

        return entries;
    }, [drivers, playback.currentIndex, mode]);

    const tabBase = "px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer";
    const tabActive = "bg-blue-600 text-white shadow-lg shadow-blue-900/40";
    const tabInactive = "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200";

    return (
        <div className="space-y-6">
            {/* Mode tabs */}
            <div className="flex items-center gap-3">
                <button
                    className={`${tabBase} ${mode === "fastest" ? tabActive : tabInactive}`}
                    onClick={() => handleModeChange("fastest")}
                >
                    🏁 Fastest Laps
                </button>
                <button
                    className={`${tabBase} ${mode === "full_race" ? tabActive : tabInactive}`}
                    onClick={() => handleModeChange("full_race")}
                >
                    🏎️ Full Race
                    {isFetchingFull && (
                        <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-white align-middle" />
                    )}
                </button>
                <span className="ml-auto rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                    {drivers.length} drivers · {activeData.length.toLocaleString()} pts
                </span>
            </div>

            {/* Main layout: map + leaderboard side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                {/* Left — Track + controls */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-300">
                            Circuit Layout
                        </h3>
                    </div>

                    {isFetchingFull ? (
                        <div className="flex h-[400px] items-center justify-center text-sm text-zinc-500">
                            Loading full race telemetry…
                        </div>
                    ) : (
                        <div className="flex items-center justify-center">
                            <TrackCanvas trackPoints={trackPoints} cars={cars} normParams={normParams} />
                        </div>
                    )}

                    <PlaybackControls
                        currentIndex={playback.currentIndex}
                        totalFrames={playback.totalFrames}
                        isPlaying={playback.isPlaying}
                        onPlay={playback.play}
                        onPause={playback.pause}
                        onSeek={playback.seek}
                    />

                    <div className="flex items-center justify-center gap-6 text-xs text-zinc-500">
                        <div className="flex items-center gap-2">
                            <span className="h-0.5 w-5 rounded bg-white" />
                            <span>Track outline</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                            <span>Start / Finish</span>
                        </div>
                    </div>
                </div>

                {/* Right — Leaderboard */}
                <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                        {mode === "fastest" ? "Fastest Lap Times" : "Live Standings"}
                    </p>
                    <Leaderboard
                        entries={leaderboard}
                        mode={mode}
                        formatLapTime={formatLapTime}
                        formatGap={formatGap}
                    />
                </div>
            </div>
        </div>
    );
}
