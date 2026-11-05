export function eventDateLabel(startsAt: string, today = new Date()): string {
  const event = new Date(startsAt);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(event, today)) return "Idag";
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(event, tomorrow)) return "Imorgon";
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", ...(event.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) }).format(event);
}
