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

export type DateLocale = "id" | "en";

const DAY: Record<DateLocale, string[]> = {
  id: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};
const MONTH: Record<DateLocale, string[]> = {
  id: [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ],
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
};

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return { y, m, d, dow };
}

export function dayName(iso: string, locale: DateLocale = "id"): string {
  return DAY[locale][parts(iso).dow];
}

export function dayShort(iso: string, locale: DateLocale = "id"): string {
  return DAY[locale][parts(iso).dow].slice(0, 3);
}

export function dayNumber(iso: string): number {
  return parts(iso).d;
}

/** "Kamis, 30 Juli" / "Thursday, 30 July" */
export function longDate(iso: string, locale: DateLocale = "id"): string {
  const { d, m } = parts(iso);
  return `${dayName(iso, locale)}, ${d} ${MONTH[locale][m - 1]}`;
}

/** "30 Jul" */
export function shortDate(iso: string, locale: DateLocale = "id"): string {
  const { d, m } = parts(iso);
  return `${d} ${MONTH[locale][m - 1].slice(0, 3)}`;
}

export function relativeDay(iso: string, locale: DateLocale = "id"): string | null {
  const today = todayISO();
  if (iso === today) return locale === "en" ? "Today" : "Hari ini";
  if (iso === addDays(today, 1)) return locale === "en" ? "Tomorrow" : "Besok";
  if (iso === addDays(today, -1)) return locale === "en" ? "Yesterday" : "Kemarin";
  return null;
}

export function formatMinutes(min: number | null | undefined, locale: DateLocale = "id"): string | null {
  if (!min || min <= 0) return null;
  if (locale === "en") {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const rest = min % 60;
    return rest ? `${h} hr ${rest} min` : `${h} hr`;
  }
  if (min < 60) return `${min} menit`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} jam ${rest} menit` : `${h} jam`;
}
