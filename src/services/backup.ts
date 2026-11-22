/**
 * Local backup / export / restore. Files are created on the device and handed to
 * the iOS share sheet – the user decides where they go (Files, AirDrop, …).
 * The app itself never uploads anything.
 */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { SQLiteDatabase } from 'expo-sqlite';

import { BACKUP_TABLES } from '@/db/schema';
import { toDateKey } from '@/utils/date';

const BACKUP_FORMAT = 'my-gym-backup';
const BACKUP_FORMAT_VERSION = 1;

type Row = Record<string, string | number | null>;
interface BackupFile {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  createdAt: string;
  tables: Record<string, Row[]>;
}

async function writeTemp(name: string, content: string): Promise<File> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  return file;
}

/** Web: trigger a normal browser download. Native: write a temp file and open the share sheet. */
async function saveText(name: string, content: string, mimeType: string, uti: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType + ';charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }
  await share(await writeTemp(name, content), mimeType, uti);
}

async function share(file: File, mimeType: string, uti: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('المشاركة غير متاحة على هذا الجهاز');
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: 'حفظ / مشاركة' });
}

async function tableColumns(db: SQLiteDatabase, table: string): Promise<string[]> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return cols.map((c) => c.name);
}

export async function buildBackup(db: SQLiteDatabase): Promise<BackupFile> {
  const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const tables: Record<string, Row[]> = {};
  for (const t of BACKUP_TABLES) {
    tables[t] = await db.getAllAsync<Row>(`SELECT * FROM ${t}`);
  }
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: v?.user_version ?? 0,
    createdAt: new Date().toISOString(),
    tables,
  };
}

/** Full JSON backup → share sheet. */
export async function exportJsonBackup(db: SQLiteDatabase): Promise<void> {
  const data = await buildBackup(db);
  await saveText(`my-gym-backup-${toDateKey()}.json`, JSON.stringify(data), 'application/json', 'public.json');
}

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Row[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [headers.join(','), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(','))].join('\r\n');
}

export type CsvKind = 'food' | 'weights' | 'workouts' | 'daily';

const CSV_QUERIES: Record<CsvKind, string> = {
  food: 'SELECT date, meal, name, calories, protein, carbs, fat FROM food_entries ORDER BY date, id',
  weights: 'SELECT date, weight_kg, source, note FROM body_weights ORDER BY date',
  workouts: `SELECT s.date, s.title, e.name AS exercise, ws.set_index, ws.weight_kg, ws.reps
             FROM workout_sets ws JOIN workout_sessions s ON s.id = ws.session_id
             JOIN exercises e ON e.id = ws.exercise_id ORDER BY s.date, s.id, ws.id`,
  daily: 'SELECT date, steps, active_kcal, basal_kcal, tdee_kcal, target_kcal, energy_source, note FROM daily_log ORDER BY date',
};

/** CSV export (opens in Numbers / Excel). BOM keeps Arabic text readable in Excel. */
export async function exportCsv(db: SQLiteDatabase, kind: CsvKind): Promise<void> {
  const rows = await db.getAllAsync<Row>(CSV_QUERIES[kind]);
  await saveText(`my-gym-${kind}-${toDateKey()}.csv`, '﻿' + toCsv(rows), 'text/csv', 'public.comma-separated-values-text');
}

/** Shares the raw SQLite database file (complete binary copy). */
export async function exportDatabaseFile(db: SQLiteDatabase): Promise<void> {
  if (Platform.OS === 'web') throw new Error('غير متاح في نسخة الويب. استخدم النسخة الاحتياطية JSON.');
  // Flush WAL so the single .db file contains everything.
  await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  const src = new File(db.databasePath);
  const copy = new File(Paths.cache, `my-gym-${toDateKey()}.db`);
  if (copy.exists) copy.delete();
  await src.copy(copy);
  await share(copy, 'application/octet-stream', 'public.database');
}

function validate(data: unknown): asserts data is BackupFile {
  const d = data as BackupFile;
  if (!d || d.format !== BACKUP_FORMAT || typeof d.tables !== 'object') {
    throw new Error('الملف ليس نسخة احتياطية صالحة من My Gym');
  }
  if (d.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('النسخة الاحتياطية من إصدار أحدث من التطبيق. حدّث التطبيق أولًا.');
  }
}

/**
 * Picks a JSON backup and REPLACES all local data with it, inside one transaction
 * (rolls back completely on any error). Returns the number of restored rows,
 * or null when the user cancels.
 */
export async function importJsonBackup(db: SQLiteDatabase): Promise<number | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'public.json', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;

  const picked = res.assets[0];
  if (!picked) return null;
  let text: string;
  if (Platform.OS === 'web') {
    // On web the picker returns the browser File object (fallback: fetch the blob: URL).
    const webFile = (picked as unknown as { file?: Blob }).file;
    const blob: Blob = webFile ?? (await (await fetch(picked.uri)).blob());
    text = await blob.text();
  } else {
    text = await new File(picked.uri).text();
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('تعذّرت قراءة الملف (JSON غير صالح)');
  }
  validate(data);

  const columns: Record<string, Set<string>> = {};
  for (const t of BACKUP_TABLES) columns[t] = new Set(await tableColumns(db, t));

  let count = 0;
  // Web has no exclusive transactions; a normal one still rolls back on error.
  type Exec = Pick<SQLiteDatabase, 'execAsync' | 'runAsync'>;
  const inTransaction = (fn: (txn: Exec) => Promise<void>) =>
    Platform.OS === 'web' ? db.withTransactionAsync(() => fn(db)) : db.withExclusiveTransactionAsync((txn) => fn(txn));
  await inTransaction(async (txn) => {
    await txn.execAsync('PRAGMA defer_foreign_keys = ON;');
    for (const t of [...BACKUP_TABLES].reverse()) {
      await txn.execAsync(`DELETE FROM ${t};`);
    }
    for (const t of BACKUP_TABLES) {
      const rows = data.tables[t] ?? [];
      if (!rows.length) continue;
      const allowed = columns[t];
      for (const row of rows) {
        // Only known columns – ignores unknown/removed fields from other versions.
        const cols = Object.keys(row).filter((c) => allowed.has(c));
        if (!cols.length) continue;
        const sql = `INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
        await txn.runAsync(sql, ...cols.map((c) => row[c] ?? null));
        count++;
      }
    }
    // Backups made before v4 kept scanned products in `barcode_foods`: move them into `foods`.
    for (const r of data.tables['barcode_foods'] ?? []) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO foods (name, brand, barcode, kcal_100, protein_100, carbs_100, fat_100, per_unit, serving_size, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        r.name ?? '',
        r.brand ?? '',
        r.barcode ?? null,
        r.kcal_100 ?? 0,
        r.protein_100 ?? 0,
        r.carbs_100 ?? 0,
        r.fat_100 ?? 0,
        r.per_unit ?? 'g',
        r.serving_g ?? null,
        r.source === 'manual' ? 'user' : 'off',
      );
      count++;
    }
  });
  return count;
}
