// Loading skeleton for the race detail page.

export default function RaceLoading() {
    return (
        <div className="min-h-screen bg-zinc-950 font-sans text-white">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
                    <span className="flex h-7 w-7 items-center justify-center rounded bg-red-600 text-xs font-black">
                        F1
                    </span>
                    <span className="text-zinc-600">/</span>
                    <div className="h-4 w-36 rounded bg-zinc-800 animate-pulse" />
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-6 py-10">
                <div className="mb-8 space-y-2">
                    <div className="h-3 w-24 rounded bg-zinc-800 animate-pulse" />
                    <div className="h-8 w-64 rounded bg-zinc-800 animate-pulse" />
                    <div className="h-4 w-40 rounded bg-zinc-800/60 animate-pulse" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                    <div className="h-[520px] rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
                    <div className="h-[520px] rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse" />
                </div>
            </main>
        </div>
    );
}
