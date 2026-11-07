export type CalendarExportEntry = { id: string; title: string; start: string; end?: string | null; allDay?: boolean; description?: string | null; location?: string | null; reminderMinutes?: number | null };
function text(value: string) { return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,"); }
function utc(value: string) { const d=new Date(value); if(!Number.isFinite(d.getTime()))throw Error("Ogiltigt kalenderdatum.");return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
function date(value: string) { const d=new Date(`${value}T00:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error("Ogiltigt kalenderdatum.");return value.replaceAll("-", ""); }
export function nextCalendarDate(value: string) { date(value);return new Date(Date.parse(`${value}T00:00:00Z`)+86400000).toISOString().slice(0,10); }
function fold(line: string) { const encoder=new TextEncoder();let part="",bytes=0;const lines:string[]=[];for(const char of line){const size=encoder.encode(char).length;if(bytes+size>75){lines.push(part);part=" ";bytes=1;}part+=char;bytes+=size;}lines.push(part);return lines.join("\r\n"); }
export function calendarFile(entries: CalendarExportEntry[], name: string, now = new Date()) {
 const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Vardilo//Family Calendar//SV","CALSCALE:GREGORIAN",`X-WR-CALNAME:${text(name)}`];
 for(const entry of entries){
  const start=entry.allDay?date(entry.start):utc(entry.start);
  const end=entry.allDay?date(entry.end||nextCalendarDate(entry.start)):entry.end?utc(entry.end):null;
  if(end && end<=start)throw Error("Slutdatum måste vara efter startdatum.");
  lines.push("BEGIN:VEVENT",`UID:${text(entry.id)}@vardilo.com`,`DTSTAMP:${utc(now.toISOString())}`,`DTSTART${entry.allDay?";VALUE=DATE":""}:${start}`);
  if(end)lines.push(`DTEND${entry.allDay?";VALUE=DATE":""}:${end}`);
  lines.push(`SUMMARY:${text(entry.title)}`);
  if(entry.description)lines.push(`DESCRIPTION:${text(entry.description)}`);
  if(entry.location)lines.push(`LOCATION:${text(entry.location)}`);
  const reminder=entry.reminderMinutes;
  if(reminder!=null&&Number.isInteger(reminder)&&reminder>0&&reminder<=40320)lines.push("BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:${text(entry.title)}`,`TRIGGER:-PT${reminder}M`,"END:VALARM");
  lines.push("END:VEVENT");
 }
 lines.push("END:VCALENDAR");return lines.map(fold).join("\r\n")+"\r\n";
}
export function downloadCalendar(content: string, filename: string) {
 const url=URL.createObjectURL(new Blob([content],{type:"text/calendar;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=filename;a.style.display="none";document.body.append(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}
