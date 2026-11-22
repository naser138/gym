/**
 * Barcode → nutrition.
 *
 * Lookup order: 1) local SQLite cache  2) Open Food Facts (free, public database).
 * Only the BARCODE NUMBER is sent to Open Food Facts – no health data, no profile,
 * nothing that identifies you. Results (and foods you enter by hand) are cached locally
 * so later scans of the same product work offline and instantly.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { createFood, getFood, getFoodByBarcode, updateFood, type Food } from './foods';

export type PerUnit = 'g' | 'ml';

export interface BarcodeFood {
  barcode: string;
  name: string;
  brand: string;
  /** Per 100 g (or 100 ml for drinks). */
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
  /** Size of one serving in g/ml, if known. */
  servingG: number | null;
  perUnit: PerUnit;
  source: 'off' | 'manual';
}

// ------------------------------------------------------------------ pure helpers

/** Digits only. Returns null if it is not a valid EAN-8 / UPC-A / EAN-13 / GTIN-14. */
export function normalizeBarcode(raw: string): string | null {
  const s = (raw || '')
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(s.length)) return null;
  return isValidGtin(s) ? s : null;
}

/** GS1 check digit validation. */
export function isValidGtin(code: string): boolean {
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

/** Codes to try on the server: iOS reports UPC-A as EAN-13 with a leading 0 and vice versa. */
export function lookupVariants(code: string): string[] {
  const out = [code];
  if (code.length === 13 && code.startsWith('0')) out.push(code.slice(1));
  if (code.length === 12) out.push('0' + code);
  return out;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Converts an Open Food Facts v2 response into our shape. Returns null if unusable. */
export function parseOffProduct(code: string, json: any): BarcodeFood | null {
  if (!json || json.status !== 1 || !json.product) return null;
  const p = json.product;
  const n = p.nutriments ?? {};

  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null) {
    const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
    if (kj != null) kcal = kj / 4.184;
  }
  const protein = num(n['proteins_100g']);
  const carbs = num(n['carbohydrates_100g']);
  const fat = num(n['fat_100g']);
  if (kcal == null && protein == null && carbs == null && fat == null) return null;

  const name = String(p.product_name_ar || p.product_name || p.product_name_en || '').trim();
  const sizeText = `${p.serving_size ?? ''} ${p.quantity ?? ''}`;
  const perUnit: PerUnit = /\d\s*(ml|cl|l)\b|مل|لتر/i.test(sizeText) ? 'ml' : 'g';
  const serving = num(p.serving_quantity);

  return {
    barcode: code,
    name: name || 'منتج بدون اسم',
    brand: String(p.brands ?? '').split(',')[0].trim(),
    kcal100: Math.round((kcal ?? (protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9) * 10) / 10,
    protein100: protein ?? 0,
    carbs100: carbs ?? 0,
    fat100: fat ?? 0,
    servingG: serving && serving > 0 && serving < 5000 ? serving : null,
    perUnit,
    source: 'off',
  };
}

/** Nutrition for an amount in grams/ml. */
export function portion(food: Pick<BarcodeFood, 'kcal100' | 'protein100' | 'carbs100' | 'fat100'>, amount: number) {
  const f = Math.max(0, amount) / 100;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    calories: Math.round(food.kcal100 * f),
    protein: r1(food.protein100 * f),
    carbs: r1(food.carbs100 * f),
    fat: r1(food.fat100 * f),
  };
}

// ------------------------------------------------------------------ storage (food library)

/** Adds (or refreshes) a scanned product in the food library and returns its id. */
export async function saveBarcodeFood(db: SQLiteDatabase, f: BarcodeFood): Promise<number> {
  const existing = await getFoodByBarcode(db, [f.barcode]);
  const input = {
    name: f.name,
    brand: f.brand,
    barcode: f.barcode,
    kcal_100: f.kcal100,
    protein_100: f.protein100,
    carbs_100: f.carbs100,
    fat_100: f.fat100,
    per_unit: f.perUnit,
    serving_size: f.servingG,
    serving_name: f.servingG ? 'حصة' : null,
    source: f.source === 'manual' ? ('user' as const) : ('off' as const),
  };
  if (existing) {
    // Never overwrite values the user corrected by hand with database values.
    if (existing.source !== 'user' || f.source === 'manual') await updateFood(db, existing.id, input);
    return existing.id;
  }
  return createFood(db, input);
}

// ------------------------------------------------------------------ network

const OFF_FIELDS = 'code,product_name,product_name_ar,product_name_en,brands,serving_size,serving_quantity,quantity,nutriments';
// Open Food Facts asks for an identifying User-Agent; a generic app name (no personal info).
const USER_AGENT = 'MyGym/1.0 (personal iOS app)';

export type LookupResult =
  | { status: 'found'; food: Food; fromCache: boolean }
  | { status: 'not-found' }
  | { status: 'offline'; message: string };

async function fetchOff(code: string, timeoutMs = 10000): Promise<BarcodeFood | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseOffProduct(code, await res.json());
  } finally {
    clearTimeout(t);
  }
}

/** Local library first, then Open Food Facts. Found products are saved to the library. */
export async function lookupBarcode(db: SQLiteDatabase, code: string): Promise<LookupResult> {
  const local = await getFoodByBarcode(db, lookupVariants(code));
  if (local) return { status: 'found', food: local, fromCache: true };
  try {
    for (const c of lookupVariants(code)) {
      const parsed = await fetchOff(c);
      if (parsed) {
        const id = await saveBarcodeFood(db, { ...parsed, barcode: code });
        const food = await getFood(db, id);
        if (food) return { status: 'found', food, fromCache: false };
      }
    }
    return { status: 'not-found' };
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return { status: 'offline', message: aborted ? 'انتهت مهلة الاتصال' : 'تعذّر الاتصال بقاعدة بيانات المنتجات' };
  }
}
