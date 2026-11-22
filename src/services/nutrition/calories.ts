/**
 * Energy (TDEE) engine.
 *
 * Rules that prevent double counting:
 *  1. Health-based TDEE = resting (basal) energy + active energy. Apple's active
 *     energy ALREADY contains workout calories, so workouts (from Health or logged
 *     in this app) are never added on top.
 *  2. Formula-based TDEE = BMR × activity multiplier. The multiplier already
 *     covers exercise, so again nothing is added for workouts.
 *  3. Health and formula values are never summed for the same component: each
 *     component (basal / active) comes from exactly one source.
 *
 * Projection: instead of using "burned so far", we estimate the end of day:
 *  basal  → so-far + typical-basal × (remaining fraction of the day)
 *  active → so-far + typical-active × (remaining fraction of the waking window)
 */
import { ageFromBirthYear, dayFraction } from '@/utils/date';
import { clamp, round } from '@/utils/number';
import type { HealthBaseline, HealthDay } from '../health/types';
import type { ActivityLevel, EnergyEstimate, EnergySource, Profile, Sex } from './types';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS_AR: Record<ActivityLevel, string> = {
  sedentary: 'خامل (عمل مكتبي)',
  light: 'خفيف (1-3 تمارين/أسبوع)',
  moderate: 'متوسط (3-5 تمارين/أسبوع)',
  active: 'عالٍ (6-7 تمارين/أسبوع)',
  very_active: 'عالٍ جدًا (عمل بدني + تمارين)',
};

/** Waking window used to spread remaining active energy (local hours). */
const WAKE_START_H = 6;
const WAKE_END_H = 23;

/** Mifflin–St Jeor (kcal/day). */
export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === 'male' ? base + 5 : base - 161;
}

export function bmrForProfile(p: Profile, now: Date = new Date()): number {
  return mifflinStJeor(p.sex, p.weightKg, p.heightCm, ageFromBirthYear(p.birthYear, now));
}

/** Fraction (0..1) of today's waking window still remaining at `now`. */
export function remainingWakeFraction(now: Date): number {
  const h = now.getHours() + now.getMinutes() / 60;
  const total = WAKE_END_H - WAKE_START_H;
  return clamp((WAKE_END_H - h) / total, 0, 1);
}

export interface EnergyInput {
  profile: Profile;
  today: HealthDay | null;
  baseline: HealthBaseline | null;
  now?: Date;
}

export function estimateEnergy({ profile, today, baseline, now = new Date() }: EnergyInput): EnergyEstimate {
  const notes: string[] = [];
  const bmr = bmrForProfile(profile, now);
  const mult = ACTIVITY_MULTIPLIERS[profile.activityLevel];
  const formulaActive = bmr * (mult - 1); // everything above BMR, incl. exercise
  const calib = clamp(profile.activeCalibration || 1, 0.5, 1.2);

  const f = dayFraction(now);
  const remWake = remainingWakeFraction(now);
  const elapsedWake = 1 - remWake;

  // ---- Basal (resting) ----
  const basalSoFar = today?.basalKcal != null && today.basalKcal > 0 ? today.basalKcal : null;
  const typicalBasal = baseline?.basalDaily ?? bmr;
  let projectedBasal: number;
  let basalFromHealth = false;
  if (basalSoFar != null) {
    projectedBasal = basalSoFar + typicalBasal * (1 - f);
    basalFromHealth = true;
    if (baseline?.basalDaily == null) notes.push('لا يوجد سجل كافٍ لطاقة الراحة؛ تم إكمال اليوم بمعادلة Mifflin–St Jeor.');
  } else {
    projectedBasal = bmr;
    if (today) notes.push('طاقة الراحة غير متاحة من تطبيق الصحة؛ تم استخدام معادلة Mifflin–St Jeor.');
  }

  // ---- Active ----
  const activeSoFarRaw = today?.activeKcal != null && today.activeKcal >= 0 ? today.activeKcal : null;
  const activeSoFar = activeSoFarRaw != null ? activeSoFarRaw * calib : null;
  let projectedActive: number;
  let activeFromHealth = false;
  if (activeSoFar != null) {
    activeFromHealth = true;
    let typicalActive: number;
    if (baseline?.activeDaily != null) {
      typicalActive = baseline.activeDaily * calib;
    } else {
      // No history: extrapolate conservatively (never above the formula's share,
      // so a morning workout is not multiplied across the rest of the day).
      const extrapolated = elapsedWake >= 0.25 ? activeSoFar / elapsedWake : formulaActive;
      typicalActive = Math.min(extrapolated, formulaActive);
      notes.push('لا يوجد سجل نشاط سابق كافٍ؛ التقدير المتبقي لليوم تقريبي.');
    }
    projectedActive = activeSoFar + typicalActive * remWake;
  } else {
    projectedActive = formulaActive;
    if (today) notes.push('الطاقة النشطة غير متاحة؛ تم استخدام معامل النشاط في الملف الشخصي.');
  }

  let source: EnergySource = basalFromHealth && activeFromHealth ? 'health' : basalFromHealth || activeFromHealth ? 'mixed' : 'formula';

  let projectedTdee = projectedBasal + projectedActive;
  const lo = bmr * 1.05;
  const hi = bmr * 3.5;
  if (projectedTdee < lo || projectedTdee > hi) {
    notes.push('القيمة المقدرة خارج النطاق المنطقي وتم تقييدها.');
    projectedTdee = clamp(projectedTdee, lo, hi);
  }

  // ---- Typical day (for the stable "average" mode) ----
  const avgBasal = baseline?.basalDaily ?? bmr;
  const avgActive = baseline?.activeDaily != null ? baseline.activeDaily * calib : formulaActive;
  const averageTdee = clamp(avgBasal + avgActive, lo, hi);

  return {
    bmr: round(bmr),
    basalSoFar: basalSoFar != null ? round(basalSoFar) : null,
    activeSoFar: activeSoFar != null ? round(activeSoFar) : null,
    projectedBasal: round(projectedBasal),
    projectedActive: round(projectedActive),
    projectedTdee: round(projectedTdee),
    averageTdee: round(averageTdee),
    source,
    notes,
  };
}

export const SOURCE_LABELS_AR: Record<EnergySource, string> = {
  health: 'من تطبيق الصحة',
  mixed: 'صحة + معادلة',
  formula: 'معادلة Mifflin–St Jeor',
};
