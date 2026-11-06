const dayMs = 86_400_000;
function dateTime(value: string): number | null {
 if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return null;
 const date = new Date(`${value}T00:00:00Z`);
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date.getTime() : null;
}
export function taskPeriodDays(start: string, end: string): number | null {
 const from = dateTime(start), to = dateTime(end);
 if (from === null || to === null) return null;
 const days = (to - from) / dayMs + 1;
 return Number.isInteger(days) && days >= 1 && days <= 366 ? days : null;
}
export function taskPeriodEnd(start: string, count: string): string {
 const from = dateTime(start);
 if (from === null || !/^[1-9]\d{0,2}$/.test(count) || Number(count) > 366) return "";
 const result = new Date(from + (Number(count) - 1) * dayMs).toISOString();
 return /^\d{4}-/.test(result) ? result.slice(0, 10) : "";
}
