/**
 * App-wide state: profile, today's energy estimate and calorie/macro targets.
 *
 * Apple Health is intentionally NOT connected in this version: energy comes from
 * Mifflin–St Jeor × activity level. The calorie engine still accepts Health data
 * (`today` / `baseline`), so HealthKit can be plugged back in here later.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { estimateEnergy } from '@/services/nutrition/calories';
import { computeTargets } from '@/services/nutrition/macros';
import type { DailyTargets, EnergyEstimate, Profile } from '@/services/nutrition/types';
import { getProfile, saveProfile, upsertDailyLog } from '@/db/repo';
import { toDateKey } from '@/utils/date';

interface AppDataValue {
  ready: boolean;
  profile: Profile | null;
  updateProfile: (p: Profile) => Promise<void>;
  energy: EnergyEstimate | null;
  targets: DailyTargets | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
  /** Day shown on the dashboard & nutrition screens (YYYY-MM-DD). */
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  /** Bumps whenever local data changes so screens can reload. */
  dataVersion: number;
  bumpData: () => void;
}

const Ctx = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [day, setDay] = useState(toDateKey());
  const [selectedDate, setSelectedDateState] = useState(toDateKey());
  const inFlight = useRef(false);
  const lastToday = useRef(toDateKey());

  // Never select a future day.
  const setSelectedDate = useCallback((d: string) => {
    const today = toDateKey();
    setSelectedDateState(d > today ? today : d);
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      setProfile(await getProfile(db));
      const today = toDateKey();
      setDay(today); // a new day after midnight → recompute & new daily log row
      // If the user was looking at "today" and the date rolled over, follow it.
      setSelectedDateState((sel) => (sel === lastToday.current ? today : sel));
      lastToday.current = today;
      setDataVersion((v) => v + 1);
    } catch (e) {
      console.warn('refresh failed', e);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
      setReady(true);
    }
  }, [db]);

  useEffect(() => {
    // Deferred so state updates happen in a callback, not synchronously in the effect.
    void Promise.resolve().then(refresh);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const updateProfile = useCallback(
    async (p: Profile) => {
      await saveProfile(db, p);
      setProfile(p);
    },
    [db],
  );

  const energy = useMemo(
    () => (profile ? estimateEnergy({ profile, today: null, baseline: null }) : null),
    // `day` makes age-dependent values recompute after midnight / new year.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, day],
  );
  const targets = useMemo(() => (profile && energy ? computeTargets(profile, energy) : null), [profile, energy]);

  // Persist a daily snapshot for the history log.
  useEffect(() => {
    if (!energy || !targets) return;
    upsertDailyLog(db, {
      date: day,
      steps: null,
      active_kcal: null,
      basal_kcal: null,
      tdee_kcal: energy.projectedTdee,
      target_kcal: targets.calories,
      energy_source: energy.source,
    }).catch(() => {});
  }, [db, energy, targets, day]);

  const value: AppDataValue = {
    ready,
    profile,
    updateProfile,
    energy,
    targets,
    refreshing,
    refresh,
    selectedDate,
    setSelectedDate,
    dataVersion,
    bumpData: () => setDataVersion((v) => v + 1),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppDataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppData must be used inside AppDataProvider');
  return v;
}
