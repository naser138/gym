import type { SQLiteDatabase } from 'expo-sqlite';
import { getExerciseHistory, type Exercise, type HistorySession } from '@/db/repo';
import type { Profile } from '@/services/nutrition/types';
import { parseRepRange, startingWeight, suggestNext, type Suggestion } from './progression';

export interface NextTarget {
  suggestion: Suggestion;
  history: HistorySession[];
  repMin: number;
  repMax: number;
}

/**
 * Next-session target for an exercise. Plan values (sets / "8-12") override the
 * exercise's own rep range when the exercise is part of today's plan.
 */
export async function loadNextTarget(
  db: SQLiteDatabase,
  ex: Exercise,
  profile: Profile | null,
  opts: { excludeSessionId?: number; planSets?: number; planReps?: string } = {},
): Promise<NextTarget> {
  const history = await getExerciseHistory(db, ex.id, { excludeSessionId: opts.excludeSessionId, limit: 30 });
  const range = parseRepRange(opts.planReps, { min: ex.rep_min ?? 8, max: ex.rep_max ?? 12 });
  const increment = ex.increment_kg ?? 2.5;
  const start = profile ? startingWeight(ex.start_ratio, profile.weightKg, profile.sex, increment) : null;
  const suggestion = suggestNext(
    history,
    { repMin: range.min, repMax: range.max, increment, targetSets: opts.planSets ?? 3 },
    start,
  );
  return { suggestion, history, repMin: range.min, repMax: range.max };
}
