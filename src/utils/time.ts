/** SQLite `datetime('now')` values are UTC "YYYY-MM-DD HH:MM:SS". */
export function parseSqlUtc(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 42 د · 1:05 س */
export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} د`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')} س`;
}

/** 01:05 or 1:02:09 – for live timers. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Duration of a session (finished, or running until now). */
export function sessionDurationMs(startedAt: string, finishedAt: string | null, now = new Date()): number {
  const a = parseSqlUtc(startedAt);
  const b = finishedAt ? parseSqlUtc(finishedAt) : now;
  return a && b ? Math.max(0, b.getTime() - a.getTime()) : 0;
}
