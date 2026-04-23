"use client";

import Link from "next/link";

export default function RaceError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white font-sans">
            <div className="max-w-md text-center space-y-4 px-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-red-500">
                    Race Data Error
                </p>
                <h1 className="text-2xl font-bold">Could not load race</h1>
                <p className="text-zinc-400 text-sm">{error.message}</p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="px-5 py-2 bg-red-600 rounded-lg text-sm font-semibold hover:bg-red-500 transition-colors"
                    >
                        Retry
                    </button>
                    <Link
                        href="/"
                        className="px-5 py-2 bg-zinc-800 rounded-lg text-sm font-semibold hover:bg-zinc-700 transition-colors"
                    >
                        Back to calendar
                    </Link>
                </div>
            </div>
        </div>
    );
}
