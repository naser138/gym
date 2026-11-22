/**
 * Progressive overload ("double progression"):
 *  1. Keep the weight and add reps until every working set reaches the top of the rep range.
 *  2. Then add the exercise's increment and drop back to the bottom of the range.
 *  3. If you fall below the bottom of the range two sessions in a row at the same weight,
 *     deload ~10% and build back up.
 */

export interface SetRecord {
  weight: number;
  reps: number;
}
export interface SessionRecord {
  date: string;
  sets: SetRecord[];
}
export interface ProgressionConfig {
  repMin: number;
  repMax: number;
  /** kg added when progressing. 0 = body-weight exercise → progress by reps only. */
  increment: number;
  targetSets: number;
}

export type SuggestionKind = 'start' | 'increase' | 'reps' | 'repeat' | 'deload';

export interface Suggestion {
  kind: SuggestionKind;
  weight: number;
  reps: number;
  sets: number;
  /** Short Arabic explanation shown under the target. */
  reason: string;
  /** Top set of the last session (for display). */
  last?: SetRecord;
}

/** Epley estimated one-rep max. */
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export function roundTo(value: number, step: number): number {
  if (!(step > 0)) return Math.round(value * 10) / 10;
  return Math.round(Math.round(value / step) * step * 100) / 100;
}

const AR_DIGITS = /[٠-٩]/g;
/** "8-12", "8–12", "10", "٨-١٢" → {min, max}. */
export function parseRepRange(text: string | null | undefined, fallback: { min: number; max: number }) {
  if (!text) return fallback;
  const s = text.replace(AR_DIGITS, (c) => String(c.charCodeAt(0) - 0x0660));
  const nums = s.match(/\d+/g)?.map(Number).filter((n) => n > 0 && n < 100) ?? [];
  if (!nums.length) return fallback;
  const min = Math.min(...nums.slice(0, 2));
  const max = Math.max(...nums.slice(0, 2));
  return { min, max };
}

/** Working weight = heaviest weight used; working sets = sets done at that weight. */
function workingSets(sets: SetRecord[]): { weight: number; sets: SetRecord[] } {
  const valid = sets.filter((s) => s.reps > 0);
  const weight = valid.reduce((m, s) => Math.max(m, s.weight), 0);
  return { weight, sets: valid.filter((s) => s.weight === weight) };
}

export function startingWeight(
  ratio: number | null | undefined,
  bodyWeightKg: number,
  sex: 'male' | 'female',
  increment: number,
): number | null {
  if (ratio == null || ratio <= 0) return null;
  const raw = bodyWeightKg * ratio * (sex === 'female' ? 0.6 : 1);
  return Math.max(increment > 0 ? increment : 1, roundTo(raw, increment > 0 ? increment : 1));
}

/**
 * @param history previous sessions for this exercise, NEWEST FIRST (exclude today's session).
 * @param startWeight optional suggested weight when there is no history.
 */
export function suggestNext(history: SessionRecord[], cfg: ProgressionConfig, startWeight: number | null = null): Suggestion {
  const { repMin, repMax, increment, targetSets } = cfg;
  const last = history.find((h) => h.sets.some((s) => s.reps > 0));

  if (!last) {
    return {
      kind: 'start',
      weight: startWeight ?? 0,
      reps: repMin,
      sets: targetSets,
      reason:
        startWeight != null
          ? 'وزن بداية تقديري. اختر وزنًا تقدر تكرره ' + repMax + ' مرة بأداء صحيح، وعدّله بعد أول مجموعة.'
          : 'أول مرة: اختر وزنًا مريحًا وسجّل أداءك، وسيُحسب هدفك القادم تلقائيًا.',
    };
  }

  const { weight: W, sets } = workingSets(last.sets);
  const minReps = Math.min(...sets.map((s) => s.reps));
  const top = sets.reduce((b, s) => (s.reps > b.reps ? s : b), sets[0]);
  const enoughSets = sets.length >= targetSets;

  // Body-weight style (no increment): progress by reps only.
  if (!(increment > 0)) {
    const target = minReps >= repMax ? minReps + 1 : Math.max(repMin, minReps + 1);
    return {
      kind: 'reps',
      weight: W,
      reps: target,
      sets: targetSets,
      reason: `آخر مرة أقل مجموعة ${minReps} تكرار. زِد تكرارًا واحدًا لكل مجموعة.`,
      last: top,
    };
  }

  if (enoughSets && minReps >= repMax) {
    return {
      kind: 'increase',
      weight: roundTo(W + increment, increment),
      reps: repMin,
      sets: targetSets,
      reason: `أكملت ${sets.length} مجموعات × ${repMax}+ بوزن ${W} كغ. ارفع الوزن ${increment} كغ وابدأ من ${repMin} تكرار.`,
      last: top,
    };
  }

  if (minReps < repMin) {
    const prev = history[history.indexOf(last) + 1];
    const prevWs = prev ? workingSets(prev.sets) : null;
    const failedTwice = prevWs != null && prevWs.weight === W && prevWs.sets.length > 0 && Math.min(...prevWs.sets.map((s) => s.reps)) < repMin;
    if (failedTwice) {
      return {
        kind: 'deload',
        weight: roundTo(W * 0.9, increment),
        reps: repMin,
        sets: targetSets,
        reason: `لم تصل ${repMin} تكرار مرتين متتاليتين بوزن ${W} كغ. خفّف 10% وابنِ من جديد.`,
        last: top,
      };
    }
    return {
      kind: 'repeat',
      weight: W,
      reps: repMin,
      sets: targetSets,
      reason: `نفس الوزن، والهدف الوصول إلى ${repMin} تكرار في كل مجموعة.`,
      last: top,
    };
  }

  const nextReps = Math.min(repMax, minReps + 1);
  return {
    kind: 'reps',
    weight: W,
    reps: nextReps,
    sets: targetSets,
    reason: enoughSets
      ? `نفس الوزن، زِد تكرارًا: الهدف ${nextReps} في كل مجموعة. عند ${repMax} في الكل يرتفع الوزن.`
      : `أكمل ${targetSets} مجموعات بنفس الوزن قبل رفعه.`,
    last: top,
  };
}

export const SUGGESTION_LABELS: Record<SuggestionKind, string> = {
  start: 'بداية',
  increase: 'ارفع الوزن',
  reps: 'زِد التكرار',
  repeat: 'ثبّت الوزن',
  deload: 'تخفيف',
};

/** Best e1RM per session, oldest → newest (for charts). */
export function e1rmSeries(history: SessionRecord[]): { date: string; value: number }[] {
  return [...history]
    .reverse()
    .map((h) => ({ date: h.date, value: Math.max(0, ...h.sets.map((s) => e1rm(s.weight, s.reps))) }))
    .filter((p) => p.value > 0);
}
