# Notification refresh — 6 November 2026

The notification page counts unread notifications separately from its latest-50 preview. Mark all read remains available when older unread entries are outside that preview. The existing recipient-filtered write still marks all unread entries; individual acknowledgements only update returned rows.

Realtime events trigger a server refresh rather than guessing counts. A visible-page 15-second fallback, focus, online and visibility handlers recover missed events. Refreshes are coalesced using the existing queue; request versions discard responses superseded by acknowledgements or effect cleanup. Background refreshes preserve the displayed list. Missing sessions or family membership clear it.

Validation: 121 unit tests, TypeScript and production build. Added tests exercise the real page loader with read preview rows plus older unread counts, and a failed count query. Existing acknowledgement and refresh queue tests remain passing. No database changes or user-data deletion. Physical device rendering was not tested in this pass.

## Inbox clears when read

The inbox now queries only unread entries before applying its latest-50 limit. Confirmed acknowledgements remove the affected rows immediately, so both opening a notification and marking all read clear it from this view. Read rows remain stored and stay hidden on reload and other devices. Failed writes leave the visible rows unchanged; incoming unread entries remain visible. The empty state says “Du har inga olästa notiser.”

Validation: 122 unit tests (including clearing all confirmed rows and the unread query predicate), typecheck and production build.
