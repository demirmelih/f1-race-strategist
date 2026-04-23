"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STEP_MS = 30; // milliseconds between frames during playback

export interface PlaybackState {
    currentIndex: number;
    isPlaying: boolean;
    totalFrames: number;
    play: () => void;
    pause: () => void;
    seek: (index: number) => void;
    reset: () => void;
}

/**
 * useRacePlayback — manages a frame-index + play/pause timer.
 *
 * Works identically whether you're animating 1 driver or 20;
 * the consumer just needs to know `totalFrames` (the max telemetry length
 * across all drivers).
 */
export function useRacePlayback(totalFrames: number): PlaybackState {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const totalRef = useRef(totalFrames);

    // Keep the ref in sync so the interval closure always reads fresh values
    useEffect(() => {
        totalRef.current = totalFrames;
    }, [totalFrames]);

    // ── Stop helper ───────────────────────────────────────────
    const stop = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsPlaying(false);
    }, []);

    // ── Play ──────────────────────────────────────────────────
    const play = useCallback(() => {
        if (totalRef.current <= 0) return;
        setIsPlaying(true);
        intervalRef.current = setInterval(() => {
            setCurrentIndex((prev) => {
                const next = prev + 1;
                if (next >= totalRef.current) {
                    clearInterval(intervalRef.current!);
                    intervalRef.current = null;
                    setIsPlaying(false);
                    return prev;
                }
                return next;
            });
        }, STEP_MS);
    }, []);

    // ── Pause ─────────────────────────────────────────────────
    const pause = useCallback(() => stop(), [stop]);

    // ── Seek ──────────────────────────────────────────────────
    const seek = useCallback(
        (index: number) => {
            stop();
            setCurrentIndex(Math.max(0, Math.min(index, totalRef.current - 1)));
        },
        [stop]
    );

    // ── Reset ─────────────────────────────────────────────────
    const reset = useCallback(() => {
        stop();
        setCurrentIndex(0);
    }, [stop]);

    // Cleanup on unmount
    useEffect(() => () => stop(), [stop]);

    // Reset index when the dataset changes (e.g. mode switch)
    useEffect(() => {
        stop();
        setCurrentIndex(0);
    }, [totalFrames, stop]);

    return {
        currentIndex,
        isPlaying,
        totalFrames,
        play,
        pause,
        seek,
        reset,
    };
}
