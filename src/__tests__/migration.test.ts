/**
 * Runs the real migrations against a real SQLite engine (node:sqlite) through a tiny
 * adapter with the expo-sqlite method names used by the app.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { addFood, copyMeal, createSession, finishSession, getFoodForDate, getSessionsForDate, getTrainedDates } from '@/db/repo';
import { migrateDbIfNeeded } from '@/db/schema';
import { COMMON_FOODS } from '@/services/food/commonFoods';
import { createFood, nutritionFor, searchFoods, type Food } from '@/services/food/foods';

jest.mock('expo-sqlite', () => ({})); // hoisted by babel-jest; only types are imported from it

type Params = (string | number | null)[];
/** Minimal typing of Node's built-in SQLite (node:sqlite), used only in tests. */
interface Statement {
  run(...p: Params): { lastInsertRowid: number | bigint; changes: number | bigint };
  get(...p: Params): unknown;
  all(...p: Params): unknown[];
}
interface RawDb {
  exec(sql: string): void;
  prepare(sql: string): Statement;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => RawDb };

function adapter(raw: RawDb) {
  return {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...params: Params) => {
      const r = raw.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    getFirstAsync: async <T,>(sql: string, ...params: Params) => (raw.prepare(sql).get(...params) as T) ?? null,
    getAllAsync: async <T,>(sql: string, ...params: Params) => raw.prepare(sql).all(...params) as T[],
  };
}

describe('database migrations', () => {
  it('migrates an empty database to the latest version', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = adapter(raw) as any;
    await migrateDbIfNeeded(db);

    expect(raw.prepare('PRAGMA user_version').get()).toEqual({ user_version: 4 });
    const foods = raw.prepare("SELECT COUNT(*) AS n FROM foods WHERE source = 'builtin'").get() as { n: number };
    expect(foods.n).toBe(COMMON_FOODS.length);
    const cols = (raw.prepare('PRAGMA table_info(food_entries)').all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(['food_id', 'amount', 'unit']));
    const ex = raw.prepare('SELECT COUNT(*) AS n FROM exercises WHERE rep_min > 0').get() as { n: number };
    expect(ex.n).toBeGreaterThan(25);

    // Running again is a no-op.
    await migrateDbIfNeeded(db);
    expect(raw.prepare('PRAGMA user_version').get()).toEqual({ user_version: 4 });
  });

  it('upgrades a v3 database and moves scanned products into the food library', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = adapter(raw) as any;
    await migrateDbIfNeeded(db);
    // Simulate a v3 install: rebuild barcode_foods content then re-run the v4 step.
    raw.exec('DROP TABLE foods;');
    raw.exec('CREATE TABLE food_entries_bak AS SELECT id, date, meal, name, calories, protein, carbs, fat, created_at FROM food_entries;');
    raw.exec('DROP TABLE food_entries; ALTER TABLE food_entries_bak RENAME TO food_entries;');
    raw.exec(
      "INSERT INTO barcode_foods (barcode, name, kcal_100, protein_100, carbs_100, fat_100, serving_g, per_unit, source) VALUES ('3017620422003', 'نوتيلا', 539, 6.3, 57.5, 30.9, 15, 'g', 'manual')",
    );
    raw.exec('PRAGMA user_version = 3');
    await migrateDbIfNeeded(db);
    const moved = raw.prepare("SELECT * FROM foods WHERE barcode = '3017620422003'").get() as Food;
    expect(moved.name).toBe('نوتيلا');
    expect(moved.source).toBe('user');
    expect(moved.serving_size).toBe(15);
  });

  it('searches and logs foods by grams', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = adapter(raw) as any;
    await migrateDbIfNeeded(db);
    const results = await searchFoods(db, 'دجاج');
    expect(results.some((f) => f.name.includes('صدر دجاج'))).toBe(true);
    const id = await createFood(db, {
      name: 'شوفان كويكر',
      brand: '',
      barcode: null,
      kcal_100: 375,
      protein_100: 13,
      carbs_100: 60,
      fat_100: 8,
      per_unit: 'g',
      serving_size: 40,
      serving_name: 'حصة',
      source: 'user',
    });
    const food = (await searchFoods(db, 'كويكر'))[0];
    expect(food.id).toBe(id);
    expect(nutritionFor(food, 60, 'g').calories).toBe(225);
  });
});

describe('workout status & meal copy', () => {
  it('copies a meal to another day and reports today’s session', async () => {
    const raw = new DatabaseSync(':memory:');
    const db = adapter(raw) as any;
    await migrateDbIfNeeded(db);

    await addFood(db, { date: '2026-11-15', meal: 'breakfast', name: 'بيض', calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, food_id: null, amount: 100, unit: 'g' });
    await addFood(db, { date: '2026-11-15', meal: 'breakfast', name: 'شوفان', calories: 156, protein: 7, carbs: 26, fat: 3, food_id: null, amount: 40, unit: 'g' });
    expect(await copyMeal(db, '2026-11-15', '2026-11-16', 'breakfast')).toBe(2);
    const copied = await getFoodForDate(db, '2026-11-16');
    expect(copied.map((e) => e.name)).toEqual(['بيض', 'شوفان']);
    expect(copied[1].amount).toBe(40);

    const id = await createSession(db, '2026-11-16', 'دفع', 1);
    expect((await getSessionsForDate(db, '2026-11-16'))[0].finished_at).toBeNull();
    expect(await getTrainedDates(db, '2026-11-15', '2026-11-21')).toEqual([]);
    await finishSession(db, id, null);
    const first = (await getSessionsForDate(db, '2026-11-16'))[0].finished_at;
    expect(first).not.toBeNull();
    expect(await getTrainedDates(db, '2026-11-15', '2026-11-21')).toEqual(['2026-11-16']);
    // Saving notes later must not move the finish time.
    raw.exec(`UPDATE workout_sessions SET finished_at = '2026-11-16 10:00:00' WHERE id = ${id}`);
    await finishSession(db, id, 'ممتاز');
    expect((await getSessionsForDate(db, '2026-11-16'))[0].finished_at).toBe('2026-11-16 10:00:00');
  });
});
