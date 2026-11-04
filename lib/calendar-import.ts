import ICAL from "ical.js";

const supportedReminders = [15, 30, 60, 1440];

function eventDate(time: ICAL.Time) {
  if (time.zone === ICAL.Timezone.localTimezone) {
    return new Date(time.year, time.month - 1, time.day, time.hour, time.minute, time.second);
  }
  return time.toJSDate();
}

export function parseCalendarFile(text: string) {
  const calendar = new ICAL.Component(ICAL.parse(text));
  if (calendar.name !== "vcalendar") throw new Error("Ogiltig kalenderfil.");

  const rows = [];
  let skipped = 0;
  let omittedReminders = 0;
  const timezones = new Set(calendar.getAllSubcomponents("vtimezone").map(zone => zone.getFirstPropertyValue("tzid")));

  for (const component of calendar.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(component);
    if (!event.uid || !component.hasProperty("dtstart") || event.isRecurring() ||
        event.isRecurrenceException() || component.hasProperty("exdate") ||
        component.getFirstPropertyValue("status") === "CANCELLED") {
      skipped++;
      continue;
    }

    const unknownTimezone = ["dtstart", "dtend"].some(name => {
      const zone = component.getFirstProperty(name)?.getParameter("tzid");
      return zone && zone !== "UTC" && !timezones.has(zone);
    });
    if (unknownTimezone) {
      skipped++;
      continue;
    }

    const start = eventDate(event.startDate);
    const end = eventDate(event.endDate);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
      skipped++;
      continue;
    }

    const alarms = component.getAllSubcomponents("valarm");
    const minutes = alarms.flatMap(alarm => {
      const property = alarm.getFirstProperty("trigger");
      const trigger = property?.getFirstValue();
      if (!(trigger instanceof ICAL.Duration) || property?.getParameter("related") === "END") return [];
      const minutes = -trigger.toSeconds() / 60;
      return supportedReminders.includes(minutes) ? [minutes] : [];
    });
    if (alarms.length > 1 || (alarms.length && !minutes.length)) omittedReminders++;

    rows.push({
      uid: event.uid,
      title: event.summary?.trim() || "Kalenderhändelse",
      description: event.description || null,
      location: event.location || null,
      starts_at: start.toISOString(),
      ends_at: end > start ? end.toISOString() : null,
      all_day: event.startDate.isDate,
      reminder_minutes: minutes.length ? Math.min(...minutes) : null,
    });
  }

  return { rows, skipped, omittedReminders };
}

export async function calendarImportId(familyId: string, uid: string) {
  const key = new TextEncoder().encode(JSON.stringify(["vardilo-ics", familyId, uid]));
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", key)).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 128;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}
