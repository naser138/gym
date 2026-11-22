/**
 * Data access for all local tables. Everything is stored on-device only.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { DEFAULT_PROFILE, type Profile } from '@/services/nutrition/types';

// ---------- Types ----------
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_LABELS_AR: Record<Meal, string> = {
  breakfast: 'فطور',
  lunch: 'غداء',
  dinner: 'عشاء',
  snack: 'سناك',
};

export interface FoodEntry {
  id: number;
  date: string;
  meal: Meal;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Set when the entry came from the food library – lets the amount be edited later. */
  food_id?: number | null;
  amount?: number | null;
  unit?: 'g' | 'ml' | 'serving' | null;
}
export type NewFoodEntry = Omit<FoodEntry, 'id'>;

export interface BodyWeight {
  id: number;
  date: string;
  weight_kg: number;
  source: 'manual' | 'health';
  note: string | null;
}

export interface DailyLog {
  date: string;
  steps: number | null;
  active_kcal: number | null;
  basal_kcal: number | null;
  tdee_kcal: number | null;
  target_kcal: number | null;
  energy_source: string | null;
  note: string | null;
}

export interface Exercise {
  id: number;
  name: string;
  muscle: string;
  equipment?: string;
  rep_min?: number;
  rep_max?: number;
  increment_kg?: number;
  start_ratio?: number | null;
  /** File name inside the app's exercise-photos folder (not a full path). */
  photo?: string | null;
}

export interface ExerciseWithStats extends Exercise {
  last_date: string | null;
  best_weight: number | null;
  best_1rm: number | null;
}

export interface PlanDay {
  weekday: number;
  title: string;
}
export interface PlanExercise {
  id: number;
  weekday: number;
  exercise_id: number;
  name: string;
  muscle: string;
  photo: string | null;
  target_sets: number;
  target_reps: string;
  position: number;
}

export interface WorkoutSession {
  id: number;
  date: string;
  title: string;
  weekday: number | null;
  notes: string | null;
  started_at: string;
  finished_at: string | null;
}
export interface WorkoutSet {
  id: number;
  session_id: number;
  exercise_id: number;
  exercise_name: string;
  set_index: number;
  weight_kg: number;
  reps: number;
}

// ---------- Settings / profile ----------
export async function getSetting<T>(db: SQLiteDatabase, key: string, fallback: T): Promise<T> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(db: SQLiteDatabase, key: string, value: unknown): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value),
  );
}

export async function getProfile(db: SQLiteDatabase): Promise<Profile | null> {
  const p = await getSetting<Partial<Profile> | null>(db, 'profile', null);
  // Merge with defaults so new fields added in later versions get sane values.
  return p ? { ...DEFAULT_PROFILE, ...p } : null;
}

export async function saveProfile(db: SQLiteDatabase, p: Profile): Promise<void> {
  await setSetting(db, 'profile', p);
}

// ---------- Food ----------
export function getFoodForDate(db: SQLiteDatabase, date: string) {
  return db.getAllAsync<FoodEntry>('SELECT * FROM food_entries WHERE date = ? ORDER BY id', date);
}

export async function addFood(db: SQLiteDatabase, e: NewFoodEntry): Promise<number> {
  const r = await db.runAsync(
    'INSERT INTO food_entries (date, meal, name, calories, protein, carbs, fat, food_id, amount, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    e.date,
    e.meal,
    e.name,
    e.calories,
    e.protein,
    e.carbs,
    e.fat,
    e.food_id ?? null,
    e.amount ?? null,
    e.unit ?? null,
  );
  return r.lastInsertRowId;
}

export function getFoodEntry(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<FoodEntry>('SELECT * FROM food_entries WHERE id = ?', id);
}

export async function updateFoodEntry(db: SQLiteDatabase, id: number, e: Omit<NewFoodEntry, 'date'>) {
  await db.runAsync(
    'UPDATE food_entries SET meal = ?, name = ?, calories = ?, protein = ?, carbs = ?, fat = ?, food_id = ?, amount = ?, unit = ? WHERE id = ?',
    e.meal,
    e.name,
    e.calories,
    e.protein,
    e.carbs,
    e.fat,
    e.food_id ?? null,
    e.amount ?? null,
    e.unit ?? null,
    id,
  );
}

export async function deleteFood(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM food_entries WHERE id = ?', id);
}


export interface DayTotals {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
export async function getFoodTotals(db: SQLiteDatabase, date: string): Promise<DayTotals> {
  const r = await db.getFirstAsync<DayTotals>(
    `SELECT ? AS date, COALESCE(SUM(calories),0) AS calories, COALESCE(SUM(protein),0) AS protein,
            COALESCE(SUM(carbs),0) AS carbs, COALESCE(SUM(fat),0) AS fat
     FROM food_entries WHERE date = ?`,
    date,
    date,
  );
  return r ?? { date, calories: 0, protein: 0, carbs: 0, fat: 0 };
}

export function getFoodTotalsRange(db: SQLiteDatabase, from: string, to: string) {
  return db.getAllAsync<DayTotals>(
    `SELECT date, SUM(calories) AS calories, SUM(protein) AS protein, SUM(carbs) AS carbs, SUM(fat) AS fat
     FROM food_entries WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
    from,
    to,
  );
}

// ---------- Body weight ----------
export function getWeights(db: SQLiteDatabase, limit = 120) {
  return db.getAllAsync<BodyWeight>('SELECT * FROM body_weights ORDER BY date DESC LIMIT ?', limit);
}

/** One weight per day. Manual entries always win over Health imports. */
export async function upsertWeight(
  db: SQLiteDatabase,
  date: string,
  kg: number,
  source: 'manual' | 'health' = 'manual',
  note: string | null = null,
) {
  if (source === 'health') {
    await db.runAsync(
      `INSERT INTO body_weights (date, weight_kg, source, note) VALUES (?, ?, 'health', NULL)
       ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg WHERE body_weights.source = 'health'`,
      date,
      kg,
    );
  } else {
    await db.runAsync(
      `INSERT INTO body_weights (date, weight_kg, source, note) VALUES (?, ?, 'manual', ?)
       ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg, source = 'manual', note = excluded.note`,
      date,
      kg,
      note,
    );
  }
}

export async function deleteWeight(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM body_weights WHERE id = ?', id);
}

// ---------- Daily log ----------
export async function upsertDailyLog(db: SQLiteDatabase, l: Omit<DailyLog, 'note'>) {
  await db.runAsync(
    `INSERT INTO daily_log (date, steps, active_kcal, basal_kcal, tdee_kcal, target_kcal, energy_source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(date) DO UPDATE SET steps = excluded.steps, active_kcal = excluded.active_kcal,
       basal_kcal = excluded.basal_kcal, tdee_kcal = excluded.tdee_kcal, target_kcal = excluded.target_kcal,
       energy_source = excluded.energy_source, updated_at = excluded.updated_at`,
    l.date,
    l.steps,
    l.active_kcal,
    l.basal_kcal,
    l.tdee_kcal,
    l.target_kcal,
    l.energy_source,
  );
}

export async function setDailyNote(db: SQLiteDatabase, date: string, note: string) {
  await db.runAsync(
    `INSERT INTO daily_log (date, note) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET note = excluded.note`,
    date,
    note,
  );
}

export function getDailyLogs(db: SQLiteDatabase, limit = 30) {
  return db.getAllAsync<DailyLog>('SELECT * FROM daily_log ORDER BY date DESC LIMIT ?', limit);
}

// ---------- Exercises & plan ----------
export function getExercises(db: SQLiteDatabase) {
  return db.getAllAsync<Exercise>('SELECT * FROM exercises ORDER BY muscle, name');
}

export async function addExercise(db: SQLiteDatabase, name: string, muscle: string): Promise<number> {
  const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE name = ?', name);
  if (existing) return existing.id;
  const r = await db.runAsync('INSERT INTO exercises (name, muscle) VALUES (?, ?)', name, muscle);
  return r.lastInsertRowId;
}

export function getExercise(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Exercise>('SELECT * FROM exercises WHERE id = ?', id);
}

/** Library list with each exercise's last date and best numbers. */
export function getExercisesWithStats(db: SQLiteDatabase) {
  return db.getAllAsync<ExerciseWithStats>(
    `SELECT e.*, MAX(s.date) AS last_date, MAX(ws.weight_kg) AS best_weight,
            MAX(ws.weight_kg * (1 + ws.reps / 30.0)) AS best_1rm
     FROM exercises e
     LEFT JOIN workout_sets ws ON ws.exercise_id = e.id AND ws.reps > 0
     LEFT JOIN workout_sessions s ON s.id = ws.session_id
     GROUP BY e.id ORDER BY e.muscle, e.name`,
  );
}

export async function updateExerciseSettings(
  db: SQLiteDatabase,
  id: number,
  s: { rep_min: number; rep_max: number; increment_kg: number },
) {
  await db.runAsync(
    'UPDATE exercises SET rep_min = ?, rep_max = ?, increment_kg = ? WHERE id = ?',
    s.rep_min,
    s.rep_max,
    s.increment_kg,
    id,
  );
}

export async function setExercisePhoto(db: SQLiteDatabase, id: number, photo: string | null) {
  await db.runAsync('UPDATE exercises SET photo = ? WHERE id = ?', photo, id);
}

export interface HistorySession {
  sessionId: number;
  date: string;
  sets: { weight: number; reps: number }[];
}

/** Previous sessions for one exercise, newest first. */
export async function getExerciseHistory(
  db: SQLiteDatabase,
  exerciseId: number,
  opts: { excludeSessionId?: number; limit?: number } = {},
): Promise<HistorySession[]> {
  const rows = await db.getAllAsync<{ session_id: number; date: string; weight_kg: number; reps: number }>(
    `SELECT ws.session_id, s.date, ws.weight_kg, ws.reps FROM workout_sets ws
     JOIN workout_sessions s ON s.id = ws.session_id
     WHERE ws.exercise_id = ? AND ws.session_id != ?
     ORDER BY s.date DESC, s.id DESC, ws.id ASC`,
    exerciseId,
    opts.excludeSessionId ?? -1,
  );
  const out: HistorySession[] = [];
  for (const r of rows) {
    let last = out[out.length - 1];
    if (!last || last.sessionId !== r.session_id) {
      if (out.length >= (opts.limit ?? 30)) break;
      last = { sessionId: r.session_id, date: r.date, sets: [] };
      out.push(last);
    }
    last.sets.push({ weight: r.weight_kg, reps: r.reps });
  }
  return out;
}

export interface ProgramDay {
  weekday: number;
  title: string;
  exercises: { name: string; sets: number; reps: string }[];
}

/** Replaces the whole weekly plan with a template (exercises must exist in the library). */
export async function applyProgram(db: SQLiteDatabase, program: ProgramDay[]) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM plan_exercises');
    await db.runAsync("UPDATE plan_days SET title = ''");
    for (const day of program) {
      await db.runAsync('UPDATE plan_days SET title = ? WHERE weekday = ?', day.title, day.weekday);
      let pos = 0;
      for (const ex of day.exercises) {
        const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE name = ?', ex.name);
        if (!row) continue;
        await db.runAsync(
          'INSERT INTO plan_exercises (weekday, exercise_id, target_sets, target_reps, position) VALUES (?, ?, ?, ?, ?)',
          day.weekday,
          row.id,
          ex.sets,
          ex.reps,
          pos++,
        );
      }
    }
  });
}

export function getPlanDays(db: SQLiteDatabase) {
  return db.getAllAsync<PlanDay>('SELECT * FROM plan_days ORDER BY weekday');
}

export async function setPlanDayTitle(db: SQLiteDatabase, weekday: number, title: string) {
  await db.runAsync('UPDATE plan_days SET title = ? WHERE weekday = ?', title, weekday);
}

export function getPlanExercises(db: SQLiteDatabase, weekday: number) {
  return db.getAllAsync<PlanExercise>(
    `SELECT pe.*, e.name, e.muscle, e.photo FROM plan_exercises pe JOIN exercises e ON e.id = pe.exercise_id
     WHERE pe.weekday = ? ORDER BY pe.position, pe.id`,
    weekday,
  );
}

export async function addPlanExercise(
  db: SQLiteDatabase,
  weekday: number,
  exerciseId: number,
  sets: number,
  reps: string,
) {
  const pos = await db.getFirstAsync<{ p: number }>(
    'SELECT COALESCE(MAX(position), -1) + 1 AS p FROM plan_exercises WHERE weekday = ?',
    weekday,
  );
  await db.runAsync(
    'INSERT INTO plan_exercises (weekday, exercise_id, target_sets, target_reps, position) VALUES (?, ?, ?, ?, ?)',
    weekday,
    exerciseId,
    sets,
    reps,
    pos?.p ?? 0,
  );
}

export async function removePlanExercise(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM plan_exercises WHERE id = ?', id);
}

// ---------- Sessions & sets ----------
export async function createSession(db: SQLiteDatabase, date: string, title: string, weekday: number | null) {
  const r = await db.runAsync(
    'INSERT INTO workout_sessions (date, title, weekday) VALUES (?, ?, ?)',
    date,
    title,
    weekday,
  );
  return r.lastInsertRowId;
}

export function getSession(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<WorkoutSession>('SELECT * FROM workout_sessions WHERE id = ?', id);
}

export function getSessions(db: SQLiteDatabase, limit = 50) {
  return db.getAllAsync<WorkoutSession & { set_count: number; volume: number }>(
    `SELECT s.*, COUNT(ws.id) AS set_count, COALESCE(SUM(ws.weight_kg * ws.reps), 0) AS volume
     FROM workout_sessions s LEFT JOIN workout_sets ws ON ws.session_id = s.id
     GROUP BY s.id ORDER BY s.date DESC, s.id DESC LIMIT ?`,
    limit,
  );
}

export async function finishSession(db: SQLiteDatabase, id: number, notes: string | null) {
  await db.runAsync(
    "UPDATE workout_sessions SET finished_at = COALESCE(finished_at, datetime('now')), notes = ? WHERE id = ?",
    notes,
    id,
  );
}

export async function deleteSession(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', id);
}

export function getSets(db: SQLiteDatabase, sessionId: number) {
  return db.getAllAsync<WorkoutSet>(
    `SELECT ws.*, e.name AS exercise_name FROM workout_sets ws JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.session_id = ? ORDER BY ws.id`,
    sessionId,
  );
}

export async function addSet(db: SQLiteDatabase, sessionId: number, exerciseId: number, weightKg: number, reps: number) {
  const idx = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) + 1 AS n FROM workout_sets WHERE session_id = ? AND exercise_id = ?',
    sessionId,
    exerciseId,
  );
  await db.runAsync(
    'INSERT INTO workout_sets (session_id, exercise_id, set_index, weight_kg, reps) VALUES (?, ?, ?, ?, ?)',
    sessionId,
    exerciseId,
    idx?.n ?? 1,
    weightKg,
    reps,
  );
}

export async function deleteSet(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM workout_sets WHERE id = ?', id);
}

/** Last time this exercise was done in another session – shown as a hint. */
export function getLastPerformance(db: SQLiteDatabase, exerciseId: number, excludeSessionId: number) {
  return db.getAllAsync<{ weight_kg: number; reps: number; date: string }>(
    `SELECT ws.weight_kg, ws.reps, s.date FROM workout_sets ws JOIN workout_sessions s ON s.id = ws.session_id
     WHERE ws.exercise_id = ? AND ws.session_id = (
       SELECT ws2.session_id FROM workout_sets ws2 JOIN workout_sessions s2 ON s2.id = ws2.session_id
       WHERE ws2.exercise_id = ? AND ws2.session_id != ? ORDER BY s2.date DESC, s2.id DESC LIMIT 1)
     ORDER BY ws.set_index`,
    exerciseId,
    exerciseId,
    excludeSessionId,
  );
}

/** Best estimated 1RM (Epley) per exercise. */
export function getPersonalRecords(db: SQLiteDatabase) {
  return db.getAllAsync<{ name: string; best_1rm: number; best_weight: number }>(
    `SELECT e.name, MAX(ws.weight_kg * (1 + ws.reps / 30.0)) AS best_1rm, MAX(ws.weight_kg) AS best_weight
     FROM workout_sets ws JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.reps > 0 GROUP BY e.id ORDER BY best_1rm DESC LIMIT 20`,
  );
}

// ---------- Today / week workout status ----------
export interface SessionSummary extends WorkoutSession {
  set_count: number;
  volume: number;
  exercise_count: number;
}

/** Sessions of one day, newest first, with set/volume/exercise counts. */
export function getSessionsForDate(db: SQLiteDatabase, date: string) {
  return db.getAllAsync<SessionSummary>(
    `SELECT s.*, COUNT(ws.id) AS set_count, COALESCE(SUM(ws.weight_kg * ws.reps), 0) AS volume,
            COUNT(DISTINCT ws.exercise_id) AS exercise_count
     FROM workout_sessions s LEFT JOIN workout_sets ws ON ws.session_id = s.id
     WHERE s.date = ? GROUP BY s.id ORDER BY s.id DESC`,
    date,
  );
}

export async function getSessionExerciseIds(db: SQLiteDatabase, sessionId: number): Promise<number[]> {
  const rows = await db.getAllAsync<{ exercise_id: number }>(
    'SELECT DISTINCT exercise_id FROM workout_sets WHERE session_id = ?',
    sessionId,
  );
  return rows.map((r) => r.exercise_id);
}

/** Dates (YYYY-MM-DD) in [from, to] that have a finished workout. */
export async function getTrainedDates(db: SQLiteDatabase, from: string, to: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM workout_sessions WHERE finished_at IS NOT NULL AND date BETWEEN ? AND ?',
    from,
    to,
  );
  return rows.map((r) => r.date);
}

/** Copies one meal's entries from a day to another. Returns how many were copied. */
export async function copyMeal(db: SQLiteDatabase, fromDate: string, toDate: string, meal: Meal): Promise<number> {
  const r = await db.runAsync(
    `INSERT INTO food_entries (date, meal, name, calories, protein, carbs, fat, food_id, amount, unit)
     SELECT ?, meal, name, calories, protein, carbs, fat, food_id, amount, unit
     FROM food_entries WHERE date = ? AND meal = ? ORDER BY id`,
    toDate,
    fromDate,
    meal,
  );
  return r.changes;
}

export async function countMealEntries(db: SQLiteDatabase, date: string): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ meal: string; n: number }>(
    'SELECT meal, COUNT(*) AS n FROM food_entries WHERE date = ? GROUP BY meal',
    date,
  );
  return Object.fromEntries(rows.map((r) => [r.meal, r.n]));
}

/** Which days in [from, to] have food logged / a finished workout – for calendar markers. */
export async function getActivityDates(db: SQLiteDatabase, from: string, to: string) {
  const [food, trained] = await Promise.all([
    db.getAllAsync<{ date: string }>('SELECT DISTINCT date FROM food_entries WHERE date BETWEEN ? AND ?', from, to),
    db.getAllAsync<{ date: string }>(
      'SELECT DISTINCT date FROM workout_sessions WHERE finished_at IS NOT NULL AND date BETWEEN ? AND ?',
      from,
      to,
    ),
  ]);
  return { food: new Set(food.map((r) => r.date)), trained: new Set(trained.map((r) => r.date)) };
}
