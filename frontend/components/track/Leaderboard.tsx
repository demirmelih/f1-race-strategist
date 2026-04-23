"use client";

import { TEAM_COLORS, teamColor } from "@/lib/constants";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
    position: number;
    abbreviation: string;
    team: string;
    speed: number;
    gear: number;
    color: string;
    totalDistance: number;
    lapNumber?: number;    // current lap (full race mode)
    lapTime?: number;      // total fastest lap duration in seconds (fastest mode)
    gapToLeader?: number;  // gap to P1 in seconds (fastest mode)
}

interface LeaderboardProps {
    entries: LeaderboardEntry[];
    mode: "fastest" | "full_race";
    formatLapTime: (seconds: number) => string;
    formatGap: (seconds: number) => string;
}

// Re-export so components that currently import from here don't break
export { TEAM_COLORS, teamColor };

// ── Component ──────────────────────────────────────────────────────────────

export default function Leaderboard({
    entries,
    mode,
    formatLapTime,
    formatGap,
}: LeaderboardProps) {
    const isFastest = mode === "fastest";

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            {/* Header — columns differ by mode */}
            {isFastest ? (
                <div className="bg-zinc-800/60 px-4 py-2 text-[10px] uppercase tracking-widest text-zinc-500 grid grid-cols-[2rem_3rem_1fr_5rem_4.5rem] gap-2">
                    <span>Pos</span>
                    <span>Driver</span>
                    <span>Team</span>
                    <span className="text-right">Time</span>
                    <span className="text-right">Gap</span>
                </div>
            ) : (
                <div className="bg-zinc-800/60 px-4 py-2 text-[10px] uppercase tracking-widest text-zinc-500 grid grid-cols-[2rem_3rem_1fr_3rem_4rem] gap-2">
                    <span>Pos</span>
                    <span>Driver</span>
                    <span>Team</span>
                    <span className="text-right">Lap</span>
                    <span className="text-right">Speed</span>
                </div>
            )}

            {/* Rows */}
            <div className="max-h-[480px] overflow-y-auto divide-y divide-zinc-800/50">
                {entries.map((e) => (
                    <div
                        key={e.abbreviation}
                        className={`grid gap-2 items-center px-4 py-1.5 text-sm hover:bg-zinc-800/40 transition-colors ${
                            isFastest
                                ? "grid-cols-[2rem_3rem_1fr_5rem_4.5rem]"
                                : "grid-cols-[2rem_3rem_1fr_3rem_4rem]"
                        }`}
                    >
                        {/* Position — gold for P1 */}
                        <span
                            className={`font-black tabular-nums ${
                                e.position === 1 ? "text-yellow-400" : "text-zinc-400"
                            }`}
                        >
                            {e.position}
                        </span>

                        {/* Driver abbreviation */}
                        <span className="font-bold" style={{ color: e.color }}>
                            {e.abbreviation}
                        </span>

                        {/* Team */}
                        <span className="text-xs text-zinc-500 truncate">{e.team}</span>

                        {isFastest ? (
                            <>
                                {/* Lap time */}
                                <span className="text-right font-mono text-xs tabular-nums text-zinc-200">
                                    {e.lapTime != null ? formatLapTime(e.lapTime) : "—"}
                                </span>
                                {/* Gap to P1 */}
                                <span
                                    className={`text-right font-mono text-xs tabular-nums ${
                                        e.position === 1 ? "text-yellow-400" : "text-zinc-500"
                                    }`}
                                >
                                    {e.gapToLeader != null ? formatGap(e.gapToLeader) : "—"}
                                </span>
                            </>
                        ) : (
                            <>
                                {/* Lap number */}
                                <span className="text-right font-semibold tabular-nums text-zinc-400">
                                    {e.lapNumber ?? "—"}
                                </span>
                                {/* Speed */}
                                <span className="text-right font-semibold tabular-nums text-zinc-300">
                                    {e.speed}
                                </span>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
