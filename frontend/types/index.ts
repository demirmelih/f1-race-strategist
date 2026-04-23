// Shared TypeScript types used across server and client components.
// All API response shapes are defined here to avoid duplication.

export interface TelemetryPoint {
    id: number;
    race_id: number;
    driver_id: number;
    driver_abbreviation: string;
    driver_team: string;
    lap_number: number;
    is_fastest_lap: boolean;
    session_time: number;
    total_distance: number;
    time: number;
    speed: number;
    gear: number;
    x_coordinate: number;
    y_coordinate: number;
}

export interface Race {
    id: number;
    year: number;
    grand_prix: string;
    session: string;
    race_date?: string | null;
}
