// Global loading skeleton shown while the home page streams in.
// Next.js automatically wraps the page in a Suspense boundary using this file.

export default function Loading() {
    return (
        <div className="min-h-screen bg-zinc-950 font-sans text-white">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
                    <span className="flex h-7 w-7 items-center justify-center rounded bg-red-600 text-xs font-black">
                        F1
                    </span>
                    <span className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-100">
                        Race Strategist
                    </span>
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-6 py-10">
                <div className="mb-8 space-y-2">
                    <div className="h-3 w-20 rounded bg-zinc-800 animate-pulse" />
                    <div className="h-8 w-48 rounded bg-zinc-800 animate-pulse" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-32 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse"
                        />
                    ))}
                </div>
            </main>
        </div>
    );
}
