"use client";

interface TelemetryPoint {
    x_coordinate: number;
    y_coordinate: number;
    speed: number;
    [key: string]: unknown;
}

interface TrackMapProps {
    telemetry: TelemetryPoint[];
}

/**
 * Normalises raw x/y coordinates into an SVG viewBox while preserving
 * the aspect ratio so the track doesn't look stretched.
 */
function buildPathData(
    telemetry: TelemetryPoint[],
    viewBoxSize: number,
    padding: number
): string {
    const xs = telemetry.map((p) => p.x_coordinate);
    const ys = telemetry.map((p) => p.y_coordinate);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    // Use the larger range so both axes share the same scale → aspect ratio preserved
    const maxRange = Math.max(rangeX, rangeY);
    const drawable = viewBoxSize - padding * 2;
    const scale = drawable / maxRange;

    // Centre the smaller axis
    const offsetX = padding + (drawable - rangeX * scale) / 2;
    const offsetY = padding + (drawable - rangeY * scale) / 2;

    const points = telemetry.map((p) => {
        const x = (p.x_coordinate - minX) * scale + offsetX;
        const y = (p.y_coordinate - minY) * scale + offsetY;
        return { x, y };
    });

    // Build SVG path string
    return points
        .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
        .join(" ");
}

export default function TrackMap({ telemetry }: TrackMapProps) {
    const SIZE = 800;
    const PADDING = 40;
    const pathData = buildPathData(telemetry, SIZE, PADDING);

    // Find speed range for the legend
    const speeds = telemetry.map((p) => p.speed);
    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
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

            {/* SVG Track */}
            <div className="flex items-center justify-center">
                <svg
                    viewBox={`0 0 ${SIZE} ${SIZE}`}
                    className="h-auto w-full max-w-2xl"
                    style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.15))" }}
                >
                    {/* Glow layer (thicker, dimmer, behind) */}
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

                    {/* Start/finish marker */}
                    {telemetry.length > 0 && (() => {
                        // Compute the first point's position (same math as buildPathData)
                        const xs = telemetry.map((p) => p.x_coordinate);
                        const ys = telemetry.map((p) => p.y_coordinate);
                        const minX = Math.min(...xs);
                        const maxX = Math.max(...xs);
                        const minY = Math.min(...ys);
                        const maxY = Math.max(...ys);
                        const rangeX = maxX - minX || 1;
                        const rangeY = maxY - minY || 1;
                        const maxRange = Math.max(rangeX, rangeY);
                        const drawable = SIZE - PADDING * 2;
                        const scale = drawable / maxRange;
                        const offsetX = PADDING + (drawable - rangeX * scale) / 2;
                        const offsetY = PADDING + (drawable - rangeY * scale) / 2;
                        const sx = (telemetry[0].x_coordinate - minX) * scale + offsetX;
                        const sy = (telemetry[0].y_coordinate - minY) * scale + offsetY;
                        return (
                            <>
                                <circle cx={sx} cy={sy} r="8" fill="#ef4444" opacity="0.4" />
                                <circle cx={sx} cy={sy} r="4" fill="#ef4444" />
                            </>
                        );
                    })()}
                </svg>
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-6 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                    <span className="h-0.5 w-5 bg-white rounded" />
                    <span>Track outline</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span>Start / Finish</span>
                </div>
            </div>
        </div>
    );
}
