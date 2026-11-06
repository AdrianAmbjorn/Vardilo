# Account and notification privacy — 7 November 2026

## Changed

Explicit logout and switching accounts on an invitation now stop this browser's push subscription before signing out the local Supabase session. Already displayed service-worker notifications are closed too. Other devices stay signed in. If the browser cannot confirm subscription removal, the account switch fails visibly and can be retried rather than silently leaving push active. Logging back in requires enabling push again on that device.

No application records, accounts, family data or schema were deleted or altered by this change. Old invalid endpoint records are left for the existing dead-endpoint cleanup; unsubscribe removes the browser's delivery subscription. This does not claim to cancel an already in-flight notification or implement automatic session-expiry cleanup.

## Verified

- 128 unit tests pass, including six device-logout cases: unsubscribe-before-local-signout ordering, unsupported/no-subscription browsers, unsubscribe rejection and false return, already-removed subscription, Auth failure propagation and closing displayed notifications.
- Existing password reset, safe confirmation redirects, invitation continuation and account-switch recovery tests pass.
- Production build and TypeScript pass.
- Read-only authenticated API regression against the existing isolated synthetic audit family passes: child adult-only calendar exclusion; hidden reservations/purchase column/masked RPC; child adult-budget exclusion; second parent cannot see the first parent's private entries; recipient-only notifications.
- Auth settings API confirms email confirmation required and anonymous signup disabled. No recovery or confirmation emails were sent to real users.
- Live SQL inspection: zero public tables without RLS. Child visibility and selected audience policies remain RESTRICTIVE. Sensitive role/invitation/wishlist RPCs are executable by authenticated users, not anon/PUBLIC. Health advisors empty.

## Limits retained

Physical-device push/lockscreen rendering, real inbox delivery, full backup/restore and legal sign-off remain unverified. Security advisors retain the previously documented pg_net schema warning, intended authenticated SECURITY DEFINER entry points and disabled leaked-password protection. No paid plan or Auth configuration was changed. See the earlier release audit for broader launch requirements.

## Repeat API check

Run `NODE_USE_ENV_PROXY=1 node scripts/verify-family-access.mjs` with the ignored synthetic fixture and public-key files already present. It reads application rows only, authenticates synthetic identities and signs those sessions out locally. It refuses a family name that does not match the fixture audit run. Never replace the fixture with real family credentials.
