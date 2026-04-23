"use client";

interface PlaybackControlsProps {
    currentIndex: number;
    totalFrames: number;
    isPlaying: boolean;
    onPlay: () => void;
    onPause: () => void;
    onSeek: (index: number) => void;
}

export default function PlaybackControls({
    currentIndex,
    totalFrames,
    isPlaying,
    onPlay,
    onPause,
    onSeek,
}: PlaybackControlsProps) {
    const progress =
        totalFrames > 1 ? (currentIndex / (totalFrames - 1)) * 100 : 0;

    const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSeek(Number(e.target.value));
    };

    const handlePlayPause = () => {
        if (isPlaying) {
            onPause();
        } else {
            // Restart from beginning if at end
            if (currentIndex >= totalFrames - 1) onSeek(0);
            // Small delay so seek(0) settles before play starts
            setTimeout(onPlay, 30);
        }
    };

    return (
        <div className="flex items-center gap-3">
            {/* Play / Pause button */}
            <button
                onClick={handlePlayPause}
                className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full
                           bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all
                           shadow-lg shadow-blue-900/40"
                aria-label={isPlaying ? "Pause" : "Play"}
            >
                {isPlaying ? (
                    <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 16 16">
                        <rect x="3" y="2" width="4" height="12" rx="1" />
                        <rect x="9" y="2" width="4" height="12" rx="1" />
                    </svg>
                ) : (
                    <svg className="h-3.5 w-3.5 text-white translate-x-px" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M4 2l10 6-10 6V2z" />
                    </svg>
                )}
            </button>

            {/* Range slider */}
            <div className="relative flex-1">
                <div
                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center"
                    style={{ width: `${progress}%` }}
                >
                    <div className="h-1 w-full rounded-full bg-blue-500" />
                </div>
                <input
                    type="range"
                    min={0}
                    max={totalFrames - 1 || 0}
                    value={currentIndex}
                    onChange={handleSlider}
                    className="relative w-full cursor-pointer appearance-none rounded-full bg-zinc-700 h-1 accent-blue-500"
                    style={{ zIndex: 1 }}
                />
            </div>

            {/* Frame counter */}
            <span className="flex-shrink-0 text-xs tabular-nums text-zinc-500 w-24 text-right">
                {currentIndex + 1} / {totalFrames}
            </span>
        </div>
    );
}
