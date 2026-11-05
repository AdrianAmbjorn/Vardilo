export type CountdownKind = "birthday" | "christmas" | "custom";
export type Countdown = { kind: CountdownKind; title: string; emoji: string; target_date: string; birthday_month?: number | null; birthday_day?: number | null };
const ordinal = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;

export function parseCountdownDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1900 || year > 9999) return null;
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function countdownRemaining(countdown: Pick<Countdown, "kind" | "target_date">, today = new Date()) {
  let target = parseCountdownDate(countdown.kind === "christmas" ? "2000-12-24" : countdown.target_date);
  if (!target) return null;
  if (countdown.kind !== "custom") {
    const month = target.getMonth(); const day = target.getDate();
    const anniversary = (year: number) => new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), 12);
    target = anniversary(today.getFullYear());
    if (ordinal(target) < ordinal(today)) target = anniversary(today.getFullYear() + 1);
  }
  const days = ordinal(target) - ordinal(today);
  return { days: Math.max(0, days), past: days < 0, target };
}
