export function eventDateLabel(startsAt: string, today = new Date(), locale = "sv-SE"): string {
  const event = new Date(startsAt);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(event, today)) return locale.startsWith("en") ? "Today" : "Idag";
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(event, tomorrow)) return locale.startsWith("en") ? "Tomorrow" : "Imorgon";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", ...(event.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) }).format(event);
}
