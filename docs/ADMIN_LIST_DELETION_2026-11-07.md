# Admin-only list deletion — 7 November 2026

Only an Admin in the list's own family can delete an entire list under Listor. A restrictive DELETE RLS policy enforces this independently of the UI; existing family membership checks remain in force. The deletion control and confirmation are hidden for other roles and the handler rejects those roles. Creating, reading, renaming, adding/completing/removing individual items remain as before. Wishlist ownership rules are unchanged.

Live SQL regression using only the isolated audit family: parent and child DELETE affect zero rows; same-family Admin deletes exactly the newly inserted test list. Transaction rolled back, so no records were permanently deleted. 140 unit tests, production build and TypeScript pass. Security advisor categories unchanged.

Recovery is a targeted DROP POLICY family_lists_admin_delete ON public.family_lists, plus reverting the UI commit, if explicitly needed. No existing list data was rewritten or deleted by this migration.
