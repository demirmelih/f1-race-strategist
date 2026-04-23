import { redirect } from "next/navigation";
import Link from "next/link";
import RaceView from "./RaceView";
import { getRace, getFastestTelemetry } from "@/lib/api";
import type { TelemetryPoint } from "@/types";

// Re-export TelemetryPoint so it can be imported from this page if needed
export type { TelemetryPoint };

export default async function RacePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    // Fetch race info first — redirect to home if the ID doesn't exist.
    // This prevents a confusing broken page when the DB was reset and IDs changed.
    const race = await getRace(id);
    if (!race) redirect("/");

    const fastestData = await getFastestTelemetry(id);
    const hasData = fastestData.length > 0;

    return (
        <div className="min-h-screen bg-zinc-950 font-sans text-white">
            {/* Top nav */}
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
                    <span className="text-zinc-600">/</span>
                    <span className="text-sm text-zinc-400 truncate">
                        {race.grand_prix}
                    </span>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-6 py-10">
                <Link
                    href="/"
                    className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-red-500"
                >
                    ← Back to calendar
                </Link>

                {/* Race header */}
                <div className="mb-8">
                    <p className="text-xs font-semibold uppercase tracking-widest text-red-500">
                        {race.year} · {race.session}
                    </p>
                    <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
                        {race.grand_prix}
                    </h2>
                    {race.race_date && (
                        <p className="mt-2 text-sm text-zinc-400">
                            {new Date(race.race_date).toLocaleDateString("en-US", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </p>
                    )}
                </div>

                {/* Error state */}
                {!hasData && (
                    <div className="flex items-center gap-3 rounded-xl border border-red-800 bg-red-950/40 px-5 py-4 text-red-400">
                        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        <p className="text-sm font-medium">
                            No telemetry data available. The backend may be offline or data hasn&apos;t been seeded.
                        </p>
                    </div>
                )}

                {/* Client-side race viewer */}
                {hasData && (
                    <RaceView
                        fastestData={fastestData}
                        raceId={id}
                    />
                )}
            </main>
        </div>
    );
}
