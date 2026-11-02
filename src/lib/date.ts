const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const KST = "Asia/Seoul";

/** 'YYYY-MM-DD' → 로컬 Date (시간대 밀림 방지) */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date → 'YYYY-MM-DD' */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 오늘 날짜 'YYYY-MM-DD' (서버가 어디 있든 한국 시간 기준) */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: KST }).format(new Date());
}

/** '2026-11-08' → '2026-11-08 (일)' */
export function formatDate(iso: string, opts: { weekday?: boolean } = {}): string {
  const { weekday = true } = opts;
  const date = parseISODate(iso);
  return weekday ? `${iso} (${WEEKDAYS[date.getDay()]})` : iso;
}

/** '2026-11-08' → '11월 8일 (일)' */
export function formatDateShort(iso: string): string {
  const date = parseISODate(iso);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
}

/** '10:00:00' → '10:00' */
export function formatTime(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

/** 해당 날짜가 속한 달의 첫날~마지막날 */
export function monthRange(iso: string): { from: string; to: string; label: string } {
  const d = parseISODate(iso);
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: toISODate(from), to: toISODate(to), label: `${d.getFullYear()}년 ${d.getMonth() + 1}월` };
}

/** 두 날짜 사이 일수 (b - a) */
export function daysBetween(aIso: string, bIso: string): number {
  const ms = parseISODate(bIso).getTime() - parseISODate(aIso).getTime();
  return Math.round(ms / 86_400_000);
}

/** 오늘로부터 며칠 뒤인지 한국어로: 오늘 / 내일 / 3일 후 / 2일 전 */
export function relativeDays(iso: string): string {
  const diff = daysBetween(todayISO(), iso);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff > 1) return `${diff}일 후`;
  if (diff === -1) return "어제";
  return `${-diff}일 전`;
}
