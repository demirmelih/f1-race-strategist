/**
 * trackMath.ts — Pure coordinate-normalisation functions.
 *
 * Zero React dependencies.  Used by TrackCanvas and the playback hook
 * to convert raw F1 telemetry X/Y coordinates into SVG viewBox space.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface RawPoint {
    x_coordinate: number;
    y_coordinate: number;
}

export interface NormParams {
    minX: number;
    minY: number;
    scale: number;
    offsetX: number;
    offsetY: number;
}

export interface ScreenPoint {
    x: number;
    y: number;
}

// ── Functions ──────────────────────────────────────────────────────────────

/**
 * Compute the transform parameters that map raw coords into a square
 * SVG viewBox while preserving the track's aspect ratio.
 */
export function buildNormParams(
    points: RawPoint[],
    viewBoxSize: number,
    padding: number
): NormParams {
    const xs = points.map((p) => p.x_coordinate);
    const ys = points.map((p) => p.y_coordinate);

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

/** Transform a single raw point into SVG-space coordinates. */
export function normPoint(
    p: RawPoint,
    { minX, minY, scale, offsetX, offsetY }: NormParams
): ScreenPoint {
    return {
        x: (p.x_coordinate - minX) * scale + offsetX,
        y: (p.y_coordinate - minY) * scale + offsetY,
    };
}

/** Build an SVG <path> `d` attribute from an array of raw points. */
export function buildPathData(
    points: RawPoint[],
    params: NormParams
): string {
    return points
        .map((p, i) => {
            const { x, y } = normPoint(p, params);
            return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ");
}
