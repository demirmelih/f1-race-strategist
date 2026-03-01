"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface TelemetryPoint {
    x_coordinate: number;
    y_coordinate: number;
    speed: number;
    n_gear?: number;
    throttle?: number;
    brake?: number;
    [key: string]: unknown;
}

interface TrackMapProps {
    telemetry: TelemetryPoint[];
}

// ── Coordinate helpers ────────────────────────────────────────────────────────

interface NormParams {
    minX: number;
    minY: number;
    scale: number;
    offsetX: number;
    offsetY: number;
}

function buildNormParams(
    telemetry: TelemetryPoint[],
    viewBoxSize: number,
    padding: number
): NormParams {
    const xs = telemetry.map((p) => p.x_coordinate);
    const ys = telemetry.map((p) => p.y_coordinate);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const maxRange = Math.max(rangeX, rangeY);
    const drawable = viewBoxSize - padding * 2;
    const scale = drawable / maxRange;
    const offsetX = padding + (drawable - rangeX * scale) / 2;
    const offsetY = padding + (drawable - rangeY * scale) / 2;
    return { minX, minY, scale, offsetX, offsetY };
}

function normPoint(
    p: TelemetryPoint,
    { minX, minY, scale, offsetX, offsetY }: NormParams
) {
    return {
        x: (p.x_coordinate - minX) * scale + offsetX,
        y: (p.y_coordinate - minY) * scale + offsetY,
    };
}

function buildPathData(telemetry: TelemetryPoint[], params: NormParams): string {
    return telemetry
        .map((p, i) => {
            const { x, y } = normPoint(p, params);
            return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ");
}

// ── Speed colour gradient (slow = blue, fast = red) ──────────────────────────

function speedColor(speed: number, min: number, max: number): string {
    const t = Math.max(0, Math.min(1, (speed - min) / (max - min || 1)));
    const r = Math.round(30 + t * 225);
    const g = Math.round(120 - t * 100);
    const b = Math.round(255 - t * 230);
    return `rgb(${r},${g},${b})`;
}

// ── Gear colour helper ────────────────────────────────────────────────────────

const GEAR_COLORS: Record<number, string> = {
    1: "#ef4444",
    2: "#f97316",
    3: "#eab308",
    4: "#22c55e",
    5: "#06b6d4",
    6: "#3b82f6",
    7: "#8b5cf6",
    8: "#ec4899",
};

// ── Main component ────────────────────────────────────────────────────────────

const SIZE = 800;
const PADDING = 40;
const PLAYBACK_STEP_MS = 30; // ms between frames when playing

export default function TrackMap({ telemetry }: TrackMapProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Pre-computed values ────────────────────────────────────────
    const normParams = buildNormParams(telemetry, SIZE, PADDING);
    const pathData = buildPathData(telemetry, normParams);

    const speeds = telemetry.map((p) => p.speed);
    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);

    const current = telemetry[currentIndex] ?? null;
    const carPos = current ? normPoint(current, normParams) : null;
    const startPos = telemetry.length > 0 ? normPoint(telemetry[0], normParams) : null;

    // ── Play / Pause logic ────────────────────────────────────────
    const stopPlayback = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsPlaying(false);
    }, []);

    const startPlayback = useCallback(() => {
        if (telemetry.length === 0) return;
        setIsPlaying(true);
        intervalRef.current = setInterval(() => {
            setCurrentIndex((prev) => {
                const next = prev + 1;
                if (next >= telemetry.length) {
                    // Reached end — stop automatically
                    clearInterval(intervalRef.current!);
                    intervalRef.current = null;
                    setIsPlaying(false);
                    return prev;
                }
                return next;
            });
        }, PLAYBACK_STEP_MS);
    }, [telemetry.length]);

    // Clean up on unmount
    useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

    const handlePlayPause = () => {
        if (isPlaying) {
            stopPlayback();
        } else {
            // If at the end, restart from beginning
            if (currentIndex >= telemetry.length - 1) setCurrentIndex(0);
            startPlayback();
        }
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        stopPlayback();
        setCurrentIndex(Number(e.target.value));
    };

    const progress =
        telemetry.length > 1 ? (currentIndex / (telemetry.length - 1)) * 100 : 0;

    // ── Render ────────────────────────────────────────────────────
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-300">
                        Circuit Layout
                    </h3>
                </div>
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400">
                    {minSpeed}–{maxSpeed} km/h
                </span>
            </div>

            {/* ── Telemetry Dashboard ── */}
            {current && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

                    {/* Speed */}
                    <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-3 flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Speed</span>
                        <span className="text-2xl font-black tabular-nums"
                            style={{ color: speedColor(current.speed, minSpeed, maxSpeed) }}>
                            {Math.round(current.speed)}
                        </span>
                        <span className="text-[10px] text-zinc-500">km/h</span>
                    </div>

                    {/* Gear */}
                    <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-3 flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Gear</span>
                        <span className="text-2xl font-black tabular-nums"
                            style={{ color: GEAR_COLORS[current.n_gear ?? 0] ?? "#ffffff" }}>
                            {current.n_gear ?? "–"}
                        </span>
                        <span className="text-[10px] text-zinc-500">selected</span>
                    </div>

                    {/* Throttle */}
                    {current.throttle !== undefined && (
                        <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-3 flex flex-col gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Throttle</span>
                            <span className="text-2xl font-black tabular-nums text-green-400">
                                {Math.round((current.throttle as number) * 100)}%
                            </span>
                            <div className="h-1 rounded-full bg-zinc-700 mt-1">
                                <div
                                    className="h-full rounded-full bg-green-400 transition-all"
                                    style={{ width: `${Math.round((current.throttle as number) * 100)}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Brake */}
                    {current.brake !== undefined && (
                        <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-3 flex flex-col gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Brake</span>
                            <span className="text-2xl font-black tabular-nums text-red-400">
                                {Math.round((current.brake as number) * 100)}%
                            </span>
                            <div className="h-1 rounded-full bg-zinc-700 mt-1">
                                <div
                                    className="h-full rounded-full bg-red-400 transition-all"
                                    style={{ width: `${Math.round((current.brake as number) * 100)}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── SVG Track ── */}
            <div className="flex items-center justify-center">
                <svg
                    viewBox={`0 0 ${SIZE} ${SIZE}`}
                    className="h-auto w-full max-w-2xl"
                    style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.15))" }}
                >
                    {/* Glow layer */}
                    <path
                        d={pathData}
                        fill="none"
                        stroke="rgba(239,68,68,0.25)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Main track line */}
                    <path
                        d={pathData}
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Start / Finish marker */}
                    {startPos && (
                        <>
                            <circle cx={startPos.x} cy={startPos.y} r="8" fill="#ef4444" opacity="0.4" />
                            <circle cx={startPos.x} cy={startPos.y} r="4" fill="#ef4444" />
                        </>
                    )}

                    {/* ── Car dot ── */}
                    {carPos && (
                        <>
                            {/* Outer glow pulse ring */}
                            <circle
                                cx={carPos.x}
                                cy={carPos.y}
                                r="14"
                                fill="none"
                                stroke="#1d4ed8"
                                strokeWidth="2"
                                opacity="0.4"
                            />
                            {/* Main dot */}
                            <circle
                                cx={carPos.x}
                                cy={carPos.y}
                                r="7"
                                fill="#3b82f6"
                                style={{
                                    filter: "drop-shadow(0 0 6px #3b82f6) drop-shadow(0 0 12px #1d4ed8)",
                                }}
                            />
                            {/* White core */}
                            <circle cx={carPos.x} cy={carPos.y} r="3" fill="white" />
                        </>
                    )}
                </svg>
            </div>

            {/* ── Playback Controls ── */}
            <div className="space-y-3">
                {/* Progress bar + frame counter */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePlayPause}
                        className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-900/40"
                        aria-label={isPlaying ? "Pause" : "Play"}
                    >
                        {isPlaying ? (
                            /* Pause icon */
                            <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 16 16">
                                <rect x="3" y="2" width="4" height="12" rx="1" />
                                <rect x="9" y="2" width="4" height="12" rx="1" />
                            </svg>
                        ) : (
                            /* Play icon */
                            <svg className="h-3.5 w-3.5 text-white translate-x-px" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M4 2l10 6-10 6V2z" />
                            </svg>
                        )}
                    </button>

                    {/* Slider */}
                    <div className="relative flex-1">
                        {/* Filled track overlay */}
                        <div
                            className="pointer-events-none absolute inset-y-0 left-0 flex items-center"
                            style={{ width: `${progress}%` }}
                        >
                            <div className="h-1 w-full rounded-full bg-blue-500" />
                        </div>

                        <input
                            type="range"
                            min={0}
                            max={telemetry.length - 1}
                            value={currentIndex}
                            onChange={handleSliderChange}
                            className="relative w-full cursor-pointer appearance-none rounded-full bg-zinc-700 h-1 accent-blue-500"
                            style={{ zIndex: 1 }}
                        />
                    </div>

                    <span className="flex-shrink-0 text-xs tabular-nums text-zinc-500 w-24 text-right">
                        {currentIndex + 1} / {telemetry.length}
                    </span>
                </div>
            </div>

            {/* ── Legend ── */}
            <div className="flex items-center justify-center gap-6 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                    <span className="h-0.5 w-5 bg-white rounded" />
                    <span>Track outline</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span>Start / Finish</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_6px_#3b82f6]" />
                    <span>Car position</span>
                </div>
            </div>
        </div>
    );
}
