/**
 * Everything is Asia/Jakarta. `en-CA` formatting gives YYYY-MM-DD, which is both
 * what Postgres `date` wants and what sorts correctly as a string — the same
 * convention Amplop uses.
 */
const TZ = "Asia/Jakarta";

export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Monday-based week start for a given date. */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // Mon = 0
  return addDays(iso, -dow);
}

export function weekDays(startISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startISO, i));
}

const DAY_ID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const MONTH_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return { y, m, d, dow };
}

export function dayName(iso: string): string {
  return DAY_ID[parts(iso).dow];
}

export function dayShort(iso: string): string {
  return DAY_ID[parts(iso).dow].slice(0, 3);
}

export function dayNumber(iso: string): number {
  return parts(iso).d;
}

/** "Kamis, 30 Juli" */
export function longDate(iso: string): string {
  const { d, m } = parts(iso);
  return `${dayName(iso)}, ${d} ${MONTH_ID[m - 1]}`;
}

/** "30 Jul" */
export function shortDate(iso: string): string {
  const { d, m } = parts(iso);
  return `${d} ${MONTH_ID[m - 1].slice(0, 3)}`;
}

export function relativeDay(iso: string): string | null {
  const today = todayISO();
  if (iso === today) return "Hari ini";
  if (iso === addDays(today, 1)) return "Besok";
  if (iso === addDays(today, -1)) return "Kemarin";
  return null;
}

export function formatMinutes(min: number | null | undefined): string | null {
  if (!min || min <= 0) return null;
  if (min < 60) return `${min} menit`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} jam ${rest} menit` : `${h} jam`;
}
