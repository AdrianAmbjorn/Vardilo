export function stockholmDate(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function taskIsCurrent(task: { scheduled_date?: string | null }, today = stockholmDate()): boolean {
  return !task.scheduled_date || task.scheduled_date === today;
}
export function canCompleteDailyTask(task: { scheduled_date?: string | null; completed_at: string | null; assigned_member_id: string | null }, member: { id: string; role: string } | null, today = stockholmDate()): boolean {
  return Boolean(member?.role === "barn" && task.assigned_member_id === member.id && task.scheduled_date === today && !task.completed_at);
}
