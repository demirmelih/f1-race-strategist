import Link from "next/link";
import TrackMap from "@/components/TrackMap";

interface TelemetryPoint {
    id: number;
    race_id: number;
    driver_id: number;
    time: number;
    speed: number;
    gear: number;
    x_coordinate: number;
    y_coordinate: number;
}

interface RaceInfo {
    id: number;
    year: number;
    grand_prix: string;
    session: string;
}

async function getRaceInfo(id: string): Promise<RaceInfo | null> {
    try {
        const res = await fetch("http://127.0.0.1:8000/api/races", {
            cache: "no-store",
        });
        if (!res.ok) return null;
        const races: RaceInfo[] = await res.json();
        return races.find((r) => r.id === Number(id)) ?? null;
    } catch {
        return null;
    }
}

async function getTelemetry(raceId: string): Promise<TelemetryPoint[]> {
    try {
        const res = await fetch(
            `http://127.0.0.1:8000/api/telemetry/${raceId}/2`,
            { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
    } catch {
        return [];
    }
}

export default async function RacePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const [race, telemetry] = await Promise.all([
        getRaceInfo(id),
        getTelemetry(id),
    ]);

    return (
        <div className="min-h-screen bg-zinc-950 font-sans text-white">
            {/* Top nav bar */}
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
                    <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
                        <span className="flex h-7 w-7 items-center justify-center rounded bg-red-600 text-xs font-black leading-none text-white">
                            F1
                        </span>
                        <span className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-100">
                            Race Strategist
                        </span>
                    </Link>

                    {/* Breadcrumb separator */}
                    <span className="text-zinc-600">/</span>
                    <span className="text-sm text-zinc-400 truncate">
                        {race ? race.grand_prix : `Race #${id}`}
                    </span>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-6 py-10">
                {/* Back link */}
                <Link
                    href="/"
                    className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-red-500"
                >
                    ← Back to calendar
                </Link>

                {/* Race header */}
                <div className="mb-8">
                    <p className="text-xs font-semibold uppercase tracking-widest text-red-500">
                        {race ? `${race.year} · ${race.session}` : "Telemetry"}
                    </p>
                    <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
                        {race ? race.grand_prix : `Race #${id}`}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                        Driver: Max Verstappen (#1) ·{" "}
                        {telemetry.length > 0
                            ? `${telemetry.length.toLocaleString()} telemetry points`
                            : "No telemetry data"}
                    </p>
                </div>

                {/* Error state */}
                {telemetry.length === 0 && (
                    <div className="flex items-center gap-3 rounded-xl border border-red-800 bg-red-950/40 px-5 py-4 text-red-400">
                        <svg
                            className="h-5 w-5 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                            />
                        </svg>
                        <p className="text-sm font-medium">
                            No telemetry data available for this race. The backend may be
                            offline or the data hasn't been seeded yet.
                        </p>
                    </div>
                )}

                {/* Track map */}
                {telemetry.length > 0 && <TrackMap telemetry={telemetry} />}
            </main>
        </div>
    );
}
