export type Sex = 'male' | 'female';
export type Goal = 'cut' | 'maintain' | 'bulk';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
/** projected = today's end-of-day estimate; average = typical day from the last 14 days. */
export type CalorieMode = 'projected' | 'average';

export interface Macros {
  protein: number; // g
  carbs: number; // g
  fat: number; // g
}

export interface Profile {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  /** Deficit for cutting, % of maintenance (e.g. 20). */
  cutPercent: number;
  /** Surplus for bulking, % of maintenance (e.g. 10). */
  bulkPercent: number;
  /** g/kg body weight; null = default for the goal. */
  proteinPerKg: number | null;
  /** g/kg body weight; null = default (0.8). */
  fatPerKg: number | null;
  calorieMode: CalorieMode;
  /** Multiplier applied to Apple active energy (watches often overestimate). 0.5–1.2 */
  activeCalibration: number;
  /** Manual override – when set, replaces the computed target. */
  manualCalories: number | null;
  /** Manual override – when set, replaces computed macros (and defines calories). */
  manualMacros: Macros | null;
}

export const DEFAULT_PROFILE: Profile = {
  sex: 'male',
  birthYear: 1995,
  heightCm: 175,
  weightKg: 75,
  activityLevel: 'moderate',
  goal: 'maintain',
  cutPercent: 20,
  bulkPercent: 10,
  proteinPerKg: null,
  fatPerKg: null,
  calorieMode: 'projected',
  activeCalibration: 1,
  manualCalories: null,
  manualMacros: null,
};

export type EnergySource = 'health' | 'mixed' | 'formula';

export interface EnergyEstimate {
  /** Mifflin–St Jeor BMR for the profile. */
  bmr: number;
  /** Burned so far today according to Health (null = unavailable). */
  basalSoFar: number | null;
  activeSoFar: number | null;
  /** End-of-day projections. */
  projectedBasal: number;
  projectedActive: number;
  projectedTdee: number;
  /** Typical full day from history (or formula). */
  averageTdee: number;
  source: EnergySource;
  notes: string[];
}

export interface DailyTargets {
  calories: number;
  macros: Macros;
  /** Maintenance used before the goal adjustment. */
  maintenance: number;
  adjustmentKcal: number;
  isManualCalories: boolean;
  isManualMacros: boolean;
  warnings: string[];
}
