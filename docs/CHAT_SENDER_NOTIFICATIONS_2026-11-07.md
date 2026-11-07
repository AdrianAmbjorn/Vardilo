# Named chat notifications — 7 November 2026

New ordinary chat notifications show “[display name] skriver i chatten:” with the message body below, both in the in-app inbox and in push. The internal after-insert trigger runs after the existing notification creation trigger, updates only notifications for that just-created message and keeps the full body. It skips named family announcements, whose chosen headings remain unchanged.

The push worker resolves the actual sender from the source chat message and same-family member profile, rather than trusting a client-supplied name or an old generic title. It still loads full message text and applies the existing encoded-size/Unicode preview bounds. Missing/blank sender names use “En familjemedlem”. Read/deleted notifications remain skipped.

Validation: 152 unit tests pass, including sender title, full body, fallback and announcement preservation. Live SQL insertion in the isolated audit family verified the actual sender and untruncated in-app body, then rolled back. No real chat message was sent. Edge calendar-push version 3 ACTIVE; missing worker-token POST returns 401. Security-advisor categories unchanged. Physical push rendering on a phone remains unverified.

Recovery: redeploy index.ts/payload.ts/deno.json from the previous Git commit cbcf7855aaa05f91c9f2db2b6717663b287893a4 (Edge v2), and drop trigger zy_chat_sender_notification plus vardilo_private.name_chat_notification() if required. Do not rewrite or delete existing notifications. The change does not replace notifications already delivered to phones.
