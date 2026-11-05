# Parent-managed child accounts

Deploy with JWT gateway verification disabled (`--no-verify-jwt`): the handler verifies the bearer token with Auth `getUser`, then checks the caller's family, adult role, and `can_manage_members` permission. This supports both legacy and asymmetric JWTs. Never expose `SUPABASE_SERVICE_ROLE_KEY` outside the Edge Function.

The child signs in through Supabase Auth with a deterministic internal email derived from the normalized parent email and child username. The internal address receives no mail. Passwords are handled only by Auth; they are never saved in application tables. Parents reset a child's password from their authenticated account.

`family_child_logins` has RLS and no authenticated write grants. Only the service-role-only `link_parent_managed_child` RPC can atomically associate the new Auth user with an existing child profile. Existing linked users cannot be overwritten. A failed registration cleans up the new Auth user.

Parent email used at registration remains the child's login identifier. The displayed `parent_email` records that identifier; it must be migrated deliberately if email-changing settings are introduced.

Run regression checks with `node --test tests/*.test.cjs` on Node 24 or newer.
