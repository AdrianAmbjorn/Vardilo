# External beta readiness — 7 November 2026

Current decision: do not invite unrelated families yet. No new product features are required to resolve the remaining gates.

| Gate | Evidence | Remaining work |
| --- | --- | --- |
| Build and regression | 140 tests, TypeScript and production build pass. Current npm audit reports zero known vulnerabilities. | CI workflow added for pushes to main and pull requests; verify its first hosted execution. |
| Family privacy | Read-only synthetic API checks passed for child calendar exclusion, reservation/purchase masking, adult/private budgets and own-recipient notifications. Admin-only list deletion passed a live RLS transaction with rollback. | Full signed-in UI check on mobile and desktop. |
| Public auth UI | Browser inspection confirmed adult/child mode switching, parent email and child username fields, optional day/month birthday with no year, adult declaration and legal links, and navigation to password recovery. | Real mailbox confirmation and recovery-link round trip across devices. No signup or password change was submitted during this browser inspection. |
| Push and devices | Payload, subscription and worker tests exist. Explicit logout cancels browser push before ending the session. | Physical iOS/Android background delivery, lockscreen content, notification click and unsubscribe checks. |
| Recovery | Git/migration checkpoints and targeted policy rollback instructions exist. Supabase organization is confirmed Free. | Full encrypted database export plus separate Storage-file export, an independent storage destination and a restore rehearsal outside production. Current connector does not expose backup download/export or database connection credentials. No paid plan, branch or restore was activated. |
| Responsible operator and rights | Legal drafts are published and explicitly not finally approved. Controller name/contact can be configured. | Confirm public legal identity/contact, actual export/deletion process, legal grounds/agreements and other open items in docs/legal/RELEASE_DECISIONS.md. |

## Important limitations

A local Chromium launch failed because the execution environment denied its required socket operation. The cloud browser was used to inspect public auth forms instead. This is not a completed mobile or signed-in UI test. No browser credential-entry workaround was attempted.

Official Supabase backup documentation recommends regular CLI exports for Free-tier projects. Paid daily database backups still exclude Storage objects. Neither an existing schema checkpoint nor a rollback transaction is a full backup or a demonstrated restore. See https://supabase.com/docs/guides/platform/backups.

## Next concrete sequence

1. Establish the full backup/export route and test restoration in an isolated environment, without touching production data.
2. Complete physical device and real mailbox checks with explicit evidence for each flow.
3. Fill verified operator details and complete the remaining privacy/rights review.
4. Invite 5–10 families only after the gates above are closed; communicate that testing is free and does not automatically become a subscription.

No user data was deleted, and no operator details, agreements or payments were guessed or accepted.
