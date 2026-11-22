import type { SQLiteDatabase } from 'expo-sqlite';
import { COMMON_FOODS } from '@/services/food/commonFoods';

export const DB_NAME = 'mygym.db';
const LATEST_VERSION = 4;

/** Runs on app start (SQLiteProvider onInit). Uses PRAGMA user_version for migrations. */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= LATEST_VERSION) {
    await db.execAsync('PRAGMA foreign_keys = ON;');
    return;
  }

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS food_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        meal TEXT NOT NULL DEFAULT 'snack',
        name TEXT NOT NULL,
        calories REAL NOT NULL DEFAULT 0,
        protein REAL NOT NULL DEFAULT 0,
        carbs REAL NOT NULL DEFAULT 0,
        fat REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_food_date ON food_entries(date);

      CREATE TABLE IF NOT EXISTS body_weights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        weight_kg REAL NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        note TEXT
      );

      CREATE TABLE IF NOT EXISTS daily_log (
        date TEXT PRIMARY KEY NOT NULL,
        steps INTEGER,
        active_kcal REAL,
        basal_kcal REAL,
        tdee_kcal REAL,
        target_kcal REAL,
        energy_source TEXT,
        note TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        muscle TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS plan_days (
        weekday INTEGER PRIMARY KEY NOT NULL CHECK (weekday BETWEEN 0 AND 6),
        title TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS plan_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weekday INTEGER NOT NULL REFERENCES plan_days(weekday) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        target_sets INTEGER NOT NULL DEFAULT 3,
        target_reps TEXT NOT NULL DEFAULT '8-12',
        position INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS workout_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        weekday INTEGER,
        notes TEXT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_session_date ON workout_sessions(date);

      CREATE TABLE IF NOT EXISTS workout_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        set_index INTEGER NOT NULL DEFAULT 1,
        weight_kg REAL NOT NULL DEFAULT 0,
        reps INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_sets_session ON workout_sets(session_id);
      CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(exercise_id);
    `);

    await seedDefaults(db);
    version = 1;
  }

  if (version === 1) {
    // v2: exercise library metadata for progressive overload + optional user photo.
    await db.execAsync(`
      ALTER TABLE exercises ADD COLUMN equipment TEXT NOT NULL DEFAULT '';
      ALTER TABLE exercises ADD COLUMN rep_min INTEGER NOT NULL DEFAULT 8;
      ALTER TABLE exercises ADD COLUMN rep_max INTEGER NOT NULL DEFAULT 12;
      ALTER TABLE exercises ADD COLUMN increment_kg REAL NOT NULL DEFAULT 2.5;
      ALTER TABLE exercises ADD COLUMN start_ratio REAL;
      ALTER TABLE exercises ADD COLUMN photo TEXT;
    `);
    await seedLibrary(db);
    version = 2;
  }

  if (version === 2) {
    // v3: local cache of scanned barcodes (from Open Food Facts or entered by hand).
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS barcode_foods (
        barcode TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        brand TEXT NOT NULL DEFAULT '',
        kcal_100 REAL NOT NULL DEFAULT 0,
        protein_100 REAL NOT NULL DEFAULT 0,
        carbs_100 REAL NOT NULL DEFAULT 0,
        fat_100 REAL NOT NULL DEFAULT 0,
        serving_g REAL,
        per_unit TEXT NOT NULL DEFAULT 'g',
        source TEXT NOT NULL DEFAULT 'off',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    version = 3;
  }

  if (version === 3) {
    // v4: food library (per 100 g/ml) + entries remember food, amount and unit so they can be edited.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        brand TEXT NOT NULL DEFAULT '',
        barcode TEXT UNIQUE,
        kcal_100 REAL NOT NULL DEFAULT 0,
        protein_100 REAL NOT NULL DEFAULT 0,
        carbs_100 REAL NOT NULL DEFAULT 0,
        fat_100 REAL NOT NULL DEFAULT 0,
        per_unit TEXT NOT NULL DEFAULT 'g',
        serving_size REAL,
        serving_name TEXT,
        source TEXT NOT NULL DEFAULT 'user',
        last_used TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);
      ALTER TABLE food_entries ADD COLUMN food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL;
      ALTER TABLE food_entries ADD COLUMN amount REAL;
      ALTER TABLE food_entries ADD COLUMN unit TEXT;
      INSERT OR IGNORE INTO foods (name, brand, barcode, kcal_100, protein_100, carbs_100, fat_100, per_unit, serving_size, source)
        SELECT name, brand, barcode, kcal_100, protein_100, carbs_100, fat_100, per_unit, serving_g,
               CASE source WHEN 'manual' THEN 'user' ELSE 'off' END
        FROM barcode_foods;
    `);
    for (const [name, kcal, p, c, f, unit, size, sname] of COMMON_FOODS) {
      await db.runAsync(
        `INSERT INTO foods (name, kcal_100, protein_100, carbs_100, fat_100, per_unit, serving_size, serving_name, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'builtin')`,
        name,
        kcal,
        p,
        c,
        f,
        unit,
        size,
        sname,
      );
    }
    version = 4;
  }

  // Future migrations:
  // if (version === 4) { await db.execAsync('ALTER TABLE ...'); version = 5; }

  await db.execAsync(`PRAGMA user_version = ${version}`);
}

const DEFAULT_EXERCISES: [string, string][] = [
  ['بنش برس', 'صدر'],
  ['بنش مائل بالدمبل', 'صدر'],
  ['تفتيح صدر بالكيبل', 'صدر'],
  ['سحب أمامي', 'ظهر'],
  ['تجديف بالبار', 'ظهر'],
  ['ديدلفت', 'ظهر'],
  ['سكوات', 'أرجل'],
  ['ليج برس', 'أرجل'],
  ['ليج كيرل', 'أرجل'],
  ['ضغط أكتاف', 'أكتاف'],
  ['رفرفة جانبية', 'أكتاف'],
  ['باي بالبار', 'باي'],
  ['تراي بالكيبل', 'تراي'],
  ['بطن كرنش', 'بطن'],
];

async function seedDefaults(db: SQLiteDatabase) {
  for (const [name, muscle] of DEFAULT_EXERCISES) {
    await db.runAsync('INSERT OR IGNORE INTO exercises (name, muscle) VALUES (?, ?)', name, muscle);
  }
  for (let d = 0; d < 7; d++) {
    await db.runAsync('INSERT OR IGNORE INTO plan_days (weekday, title) VALUES (?, ?)', d, '');
  }
}

/**
 * Exercise library: [name, muscle, equipment, repMin, repMax, incrementKg, startRatio]
 * startRatio = conservative beginner working weight as a fraction of body weight (men;
 * women ×0.6). For dumbbells it is per hand. 0 = body-weight exercise (log added weight).
 */
type LibRow = [string, string, string, number, number, number, number];
export const EXERCISE_LIBRARY: LibRow[] = [
  ['بنش برس', 'صدر', 'بار', 6, 10, 2.5, 0.5],
  ['بنش برس بالدمبل', 'صدر', 'دمبل', 8, 12, 2, 0.18],
  ['بنش مائل بالدمبل', 'صدر', 'دمبل', 8, 12, 2, 0.15],
  ['ضغط صدر بالجهاز', 'صدر', 'جهاز', 10, 12, 5, 0.4],
  ['تفتيح صدر بالكيبل', 'صدر', 'كيبل', 12, 15, 2.5, 0.1],
  ['ديبس', 'صدر', 'وزن الجسم', 8, 12, 2.5, 0],
  ['سحب أمامي', 'ظهر', 'كيبل', 8, 12, 5, 0.5],
  ['عقلة', 'ظهر', 'وزن الجسم', 5, 10, 2.5, 0],
  ['تجديف بالبار', 'ظهر', 'بار', 8, 10, 2.5, 0.4],
  ['تجديف بالكيبل جالس', 'ظهر', 'كيبل', 10, 12, 5, 0.45],
  ['تجديف بالدمبل', 'ظهر', 'دمبل', 8, 12, 2, 0.2],
  ['ديدلفت', 'ظهر', 'بار', 4, 6, 5, 0.8],
  ['سكوات', 'أرجل', 'بار', 5, 8, 5, 0.6],
  ['ليج برس', 'أرجل', 'جهاز', 10, 15, 10, 1.2],
  ['رومانيان ديدلفت', 'أرجل', 'بار', 8, 10, 5, 0.5],
  ['لانجز بالدمبل', 'أرجل', 'دمبل', 10, 12, 2, 0.1],
  ['ليج كيرل', 'أرجل', 'جهاز', 10, 15, 5, 0.3],
  ['ليج اكستنشن', 'أرجل', 'جهاز', 12, 15, 5, 0.35],
  ['سمانة واقف', 'أرجل', 'جهاز', 12, 20, 5, 0.5],
  ['ضغط أكتاف', 'أكتاف', 'دمبل', 8, 12, 2, 0.15],
  ['رفرفة جانبية', 'أكتاف', 'دمبل', 12, 20, 1, 0.05],
  ['رفرفة خلفية', 'أكتاف', 'دمبل', 12, 20, 1, 0.05],
  ['فيس بول', 'أكتاف', 'كيبل', 12, 15, 2.5, 0.15],
  ['باي بالبار', 'باي', 'بار', 8, 12, 2.5, 0.25],
  ['باي بالدمبل', 'باي', 'دمبل', 10, 12, 1, 0.1],
  ['هامر', 'باي', 'دمبل', 10, 12, 1, 0.1],
  ['تراي بالكيبل', 'تراي', 'كيبل', 10, 15, 2.5, 0.2],
  ['تراي فوق الرأس', 'تراي', 'كيبل', 10, 15, 2.5, 0.15],
  ['سكل كراشر', 'تراي', 'بار', 8, 12, 2.5, 0.2],
  ['بطن كرنش', 'بطن', 'وزن الجسم', 15, 25, 0, 0],
  ['رفع الأرجل معلق', 'بطن', 'وزن الجسم', 10, 20, 0, 0],
];

async function seedLibrary(db: SQLiteDatabase) {
  for (const [name, muscle, equipment, rmin, rmax, inc, ratio] of EXERCISE_LIBRARY) {
    await db.runAsync('INSERT OR IGNORE INTO exercises (name, muscle) VALUES (?, ?)', name, muscle);
    await db.runAsync(
      `UPDATE exercises SET muscle = ?, equipment = ?, rep_min = ?, rep_max = ?, increment_kg = ?, start_ratio = ?
       WHERE name = ?`,
      muscle,
      equipment,
      rmin,
      rmax,
      inc,
      ratio,
      name,
    );
  }
}

/** Tables included in JSON backup, in restore order (parents first). */
export const BACKUP_TABLES = [
  'settings',
  'exercises',
  'plan_days',
  'plan_exercises',
  'foods',
  'food_entries',
  'body_weights',
  'daily_log',
  'workout_sessions',
  'workout_sets',
] as const;
