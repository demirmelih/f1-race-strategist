// Centralised constants used across the frontend.
// Import from here instead of hardcoding values in components.

export const API_BASE = "http://127.0.0.1:8000";

// 2023 F1 season team colors
export const TEAM_COLORS: Record<string, string> = {
    "Red Bull Racing": "#3671C6",
    "Mercedes": "#27F4D2",
    "Ferrari": "#E8002D",
    "McLaren": "#FF8000",
    "Aston Martin": "#229971",
    "Alpine": "#FF87BC",
    "Williams": "#64C4FF",
    "AlphaTauri": "#6692FF",
    "Alfa Romeo": "#C92D4B",
    "Haas F1 Team": "#B6BABD",
};

export function teamColor(team: string): string {
    return TEAM_COLORS[team] ?? "#888888";
}
