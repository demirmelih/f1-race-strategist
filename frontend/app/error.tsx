"use client";

// Global error boundary: catches unhandled errors in the app shell.
// Next.js requires this file to be a Client Component.

export default function GlobalError({
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
                    Error
                </p>
                <h1 className="text-2xl font-bold">Something went wrong</h1>
                <p className="text-zinc-400 text-sm">{error.message}</p>
                <button
                    onClick={reset}
                    className="px-5 py-2 bg-red-600 rounded-lg text-sm font-semibold hover:bg-red-500 transition-colors"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
