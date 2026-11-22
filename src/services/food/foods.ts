/**
 * Food library (MyFitnessPal style): every food stores nutrition per 100 g or 100 ml,
 * plus an optional named serving (e.g. "بيضة" = 50 g). Entries are logged as an amount
 * in g / ml / servings and the nutrition is calculated from the per-100 values.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

export type PerUnit = 'g' | 'ml';
export type AmountUnit = 'g' | 'ml' | 'serving';
export type FoodSource = 'builtin' | 'user' | 'off';

export interface Food {
  id: number;
  name: string;
  brand: string;
  barcode: string | null;
  kcal_100: number;
  protein_100: number;
  carbs_100: number;
  fat_100: number;
  per_unit: PerUnit;
  serving_size: number | null;
  serving_name: string | null;
  source: FoodSource;
  last_used: string | null;
}

export type FoodInput = Omit<Food, 'id' | 'last_used'>;

export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ------------------------------------------------------------------ pure math

export const unitLabel = (u: PerUnit) => (u === 'ml' ? 'مل' : 'غ');

/** Amount converted to grams / ml. */
export function toBaseAmount(food: Pick<Food, 'serving_size'>, amount: number, unit: AmountUnit): number {
  if (!(amount > 0)) return 0;
  if (unit === 'serving') return food.serving_size && food.serving_size > 0 ? amount * food.serving_size : 0;
  return amount;
}

export function nutritionFor(
  food: Pick<Food, 'kcal_100' | 'protein_100' | 'carbs_100' | 'fat_100' | 'serving_size'>,
  amount: number,
  unit: AmountUnit,
): Nutrition & { base: number } {
  const base = toBaseAmount(food, amount, unit);
  const f = base / 100;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    base,
    calories: Math.round(food.kcal_100 * f),
    protein: r1(food.protein_100 * f),
    carbs: r1(food.carbs_100 * f),
    fat: r1(food.fat_100 * f),
  };
}

const n1 = (x: number) => String(Math.round(x * 10) / 10);

/** "150 غ" · "2 بيضة (100 غ)" */
export function describeAmount(
  food: Pick<Food, 'per_unit' | 'serving_size' | 'serving_name'>,
  amount: number,
  unit: AmountUnit,
): string {
  const u = unitLabel(food.per_unit);
  if (unit === 'serving') {
    const base = toBaseAmount(food, amount, unit);
    return `${n1(amount)} ${food.serving_name || 'حصة'} (${n1(base)} ${u})`;
  }
  return `${n1(amount)} ${u}`;
}

/** Label values are often "per serving": convert them to per 100. */
export function per100FromServing(v: Nutrition, servingSize: number): Nutrition {
  if (!(servingSize > 0)) return v;
  const k = 100 / servingSize;
  const r1 = (x: number) => Math.round(x * k * 10) / 10;
  return { calories: r1(v.calories), protein: r1(v.protein), carbs: r1(v.carbs), fat: r1(v.fat) };
}

/** Sanity check for per-100 values (energy density can't exceed pure fat ≈ 900 kcal). */
export function validatePer100(v: Nutrition): string | null {
  if (!(v.calories > 0) || v.calories > 900) return 'السعرات لكل 100 يجب أن تكون بين 1 و900.';
  if ([v.protein, v.carbs, v.fat].some((x) => x < 0 || x > 100)) return 'الماكروز لكل 100 يجب أن تكون بين 0 و100 غ.';
  if (v.protein + v.carbs + v.fat > 105) return 'مجموع الماكروز أكبر من 100 غ لكل 100 غ.';
  return null;
}

// ------------------------------------------------------------------ storage

export function getFood(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Food>('SELECT * FROM foods WHERE id = ?', id);
}

export async function getFoodByBarcode(db: SQLiteDatabase, codes: string[]): Promise<Food | null> {
  for (const c of codes) {
    const f = await db.getFirstAsync<Food>('SELECT * FROM foods WHERE barcode = ?', c);
    if (f) return f;
  }
  return null;
}

/** Search by name/brand; recently used first. Empty query → recent + common foods. */
export function searchFoods(db: SQLiteDatabase, query: string, limit = 40) {
  const q = query.trim();
  if (!q) {
    return db.getAllAsync<Food>(
      `SELECT * FROM foods ORDER BY (last_used IS NULL), last_used DESC, (source = 'builtin'), name LIMIT ?`,
      limit,
    );
  }
  const like = `%${q.replace(/[%_]/g, '')}%`;
  return db.getAllAsync<Food>(
    `SELECT * FROM foods WHERE name LIKE ? OR brand LIKE ? OR barcode = ?
     ORDER BY (name LIKE ?) DESC, (last_used IS NULL), last_used DESC, name LIMIT ?`,
    like,
    like,
    q,
    `${q}%`,
    limit,
  );
}

export async function createFood(db: SQLiteDatabase, f: FoodInput): Promise<number> {
  const r = await db.runAsync(
    `INSERT INTO foods (name, brand, barcode, kcal_100, protein_100, carbs_100, fat_100, per_unit, serving_size, serving_name, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    f.name,
    f.brand,
    f.barcode,
    f.kcal_100,
    f.protein_100,
    f.carbs_100,
    f.fat_100,
    f.per_unit,
    f.serving_size,
    f.serving_name,
    f.source,
  );
  return r.lastInsertRowId;
}

export async function updateFood(db: SQLiteDatabase, id: number, f: FoodInput) {
  await db.runAsync(
    `UPDATE foods SET name = ?, brand = ?, barcode = ?, kcal_100 = ?, protein_100 = ?, carbs_100 = ?, fat_100 = ?,
       per_unit = ?, serving_size = ?, serving_name = ?, source = ? WHERE id = ?`,
    f.name,
    f.brand,
    f.barcode,
    f.kcal_100,
    f.protein_100,
    f.carbs_100,
    f.fat_100,
    f.per_unit,
    f.serving_size,
    f.serving_name,
    f.source,
    id,
  );
}

export async function touchFood(db: SQLiteDatabase, id: number) {
  await db.runAsync("UPDATE foods SET last_used = datetime('now') WHERE id = ?", id);
}

/** Removes a food from the library. Logged entries keep their numbers (food_id → NULL). */
export async function removeFood(db: SQLiteDatabase, id: number) {
  await db.runAsync('UPDATE food_entries SET food_id = NULL WHERE food_id = ?', id);
  await db.runAsync('DELETE FROM foods WHERE id = ?', id);
}
