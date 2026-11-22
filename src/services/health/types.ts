export type HealthAvailability =
  | 'available' // HealthKit present and native module linked
  | 'not-ios' // Android / web
  | 'module-missing' // Running in Expo Go or a build without the native module
  | 'device-unsupported'; // e.g. iPad without Health

export type HealthAuthState = 'unknown' | 'requested' | 'error';

export interface HealthWorkout {
  id: string;
  name: string;
  start: string;
  end: string;
  durationMin: number;
  /** kcal reported by the workout. ALREADY INCLUDED in active energy – display only. */
  kcal: number | null;
  source: string;
}

/** Health data for one local day. `null` = no data / not permitted / error. */
export interface HealthDay {
  dateKey: string;
  steps: number | null;
  activeKcal: number | null;
  basalKcal: number | null;
  workouts: HealthWorkout[];
  /** true when the day is still in progress (today). */
  partial: boolean;
}

export interface HealthBaseline {
  /** Median full-day active kcal from previous complete days. */
  activeDaily: number | null;
  /** Median full-day resting kcal from previous complete days. */
  basalDaily: number | null;
  daysWithData: number;
}

export interface HealthProfileHints {
  weightKg: number | null;
  heightCm: number | null;
  birthYear: number | null;
  sex: 'male' | 'female' | null;
}
