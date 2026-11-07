# Calendar export and meal-week selection — 7 November 2026

The home meal widget now has previous/next, current-week and date-based week selection, with an ISO week number and one saved menu per family/date. It fetches only the selected week's seven dates; changing weeks no longer requires reloading the whole home page. Admin/parent editing remains protected by the existing database rules. Children can read/export but cannot invoke save. Unsaved changes require confirmation before switching weeks or closing the editor; failed writes retain the draft. Stale week fetches are ignored and export is disabled until the selected week is loaded.

“Till min kalender” exports the selected week's saved, non-empty meals as all-day events with stable family/date identities. It never exports unsaved drafts. Dates have exclusive next-day ends, including year/leap-day boundaries.

The calendar page offers the same action for currently displayed events, respecting its view and search/type/person filters. Export reads only the already authorized loaded rows. Materialized recurring occurrences get individual stable IDs; an occurrence spanning several days is deduplicated. Unfiltered views also include overlapping holidays/study days. Timed entries use exact UTC instants; all-day dates match the dates displayed in Vardilo. Locations, descriptions and supported reminder intervals are included.

The .ics serializer escapes text to prevent injected properties/events, folds UTF-8 lines to 75 octets, validates dates and produces CRLF-delimited RFC-style calendar data. Six export/week tests and four meal-editor tests were added. The existing ical.js parser verifies exported files round-trip correctly.

Validation: 150 unit tests, production build and TypeScript pass. No dependencies, schema or permissions changed; no existing menu/calendar rows were edited as part of implementation. Changes remain reversible through Git.

This is a one-time file export, not an account connection or live/two-way calendar subscription. The destination app chooses how to import the file and whether to deduplicate repeat imports. Physical Apple/Google/Outlook import UX and authenticated mobile layout were not verified in this pass. No calendar data was sent to another provider automatically; the user chooses what to do with the downloaded file.
