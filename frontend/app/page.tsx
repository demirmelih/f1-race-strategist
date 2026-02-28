// Server Component — runs on the server, no "use client" needed.

import Link from "next/link";

interface Race {
  id: number;
  year: number;
  grand_prix: string;
  session: string;
}

async function getRaces(): Promise<Race[]> {
  try {
    const res = await fetch("http://127.0.0.1:8000/api/races", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API responded with status ${res.status}`);
    return res.json();
  } catch {
    return [];
  }
}

function RaceCard({ race }: { race: Race }) {
  return (
    <Link
      href={`/race/${race.id}`}
      className="group relative flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-lg transition-all duration-200 hover:border-red-600 hover:shadow-red-900/30 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
    >
      {/* Red accent bar */}
      <span className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-red-600 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      {/* Year badge */}
      <span className="w-fit rounded-full bg-red-600/15 px-3 py-0.5 text-xs font-bold uppercase tracking-widest text-red-500">
        {race.year}
      </span>

      {/* Grand Prix name */}
      <h2 className="text-lg font-bold leading-tight text-white">
        {race.grand_prix}
      </h2>

      {/* Session type */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <svg
          className="h-3.5 w-3.5 text-red-500"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
        <span className="uppercase tracking-wide">{race.session}</span>
      </div>

      {/* Arrow indicator */}
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 transition-all duration-200 group-hover:text-red-500 group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}

function ErrorBanner() {
  return (
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
        Could not connect to the API at{" "}
        <code className="rounded bg-red-900/50 px-1 py-0.5 font-mono text-xs text-red-300">
          http://127.0.0.1:8000/api/races
        </code>
        . Make sure the backend server is running.
      </p>
    </div>
  );
}

export default async function Home() {
  const races = await getRaces();

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-white">
      {/* Top nav bar */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-red-600 text-xs font-black leading-none text-white">
            F1
          </span>
          <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-100">
            Race Strategist
          </h1>
          <div className="ml-auto h-2 w-2 animate-pulse rounded-full bg-green-500" title="Backend live" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Page heading */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-500">
            Dashboard
          </p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
            Race Calendar
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {races.length > 0
              ? `${races.length} session${races.length !== 1 ? "s" : ""} loaded — click a race to view telemetry`
              : "Fetching sessions from the API…"}
          </p>
        </div>

        {/* Error state */}
        {races.length === 0 && <ErrorBanner />}

        {/* Race grid */}
        {races.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {races.map((race) => (
              <RaceCard key={race.id} race={race} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
