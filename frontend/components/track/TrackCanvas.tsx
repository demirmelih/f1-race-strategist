"use client";

import { buildNormParams, buildPathData, normPoint } from "@/lib/trackMath";
import type { NormParams, RawPoint, ScreenPoint } from "@/lib/trackMath";

// ── Public types ───────────────────────────────────────────────────────────

export interface CarDot {
    /** SVG-space position */
    pos: ScreenPoint;
    /** CSS colour */
    color: string;
    /** Short label (e.g. driver abbreviation) */
    label: string;
}

interface TrackCanvasProps {
    /** All raw points used to draw the track outline (typically from one driver's lap). */
    trackPoints: RawPoint[];
    /** One entry per driver — positions for the current frame. */
    cars: CarDot[];
    /** Optional pre-computed NormParams (avoids re-computing on every frame). */
    normParams?: NormParams;
}

// ── Constants ───────────────────────────────────────────────────────────────

const SIZE = 800;
const PADDING = 40;

// ── Component ──────────────────────────────────────────────────────────────

export default function TrackCanvas({
    trackPoints,
    cars,
    normParams: externalParams,
}: TrackCanvasProps) {
    const params = externalParams ?? buildNormParams(trackPoints, SIZE, PADDING);
    const pathData = buildPathData(trackPoints, params);
    const startPos = trackPoints.length > 0 ? normPoint(trackPoints[0], params) : null;

    return (
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

            {/* Track outline */}
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

            {/* Car dots */}
            {cars.map((car) => (
                <g key={car.label}>
                    {/* Outer ring */}
                    <circle
                        cx={car.pos.x}
                        cy={car.pos.y}
                        r="12"
                        fill="none"
                        stroke={car.color}
                        strokeWidth="2"
                        opacity="0.4"
                    />
                    {/* Filled dot */}
                    <circle
                        cx={car.pos.x}
                        cy={car.pos.y}
                        r="6"
                        fill={car.color}
                        style={{
                            filter: `drop-shadow(0 0 4px ${car.color})`,
                        }}
                    />
                    {/* Label */}
                    <text
                        x={car.pos.x}
                        y={car.pos.y - 16}
                        textAnchor="middle"
                        fill="white"
                        fontSize="10"
                        fontWeight="bold"
                        style={{ pointerEvents: "none" }}
                    >
                        {car.label}
                    </text>
                </g>
            ))}
        </svg>
    );
}
