# Profile and family loading resilience — 7 November 2026

Profile loading now distinguishes an unavailable Auth or family-member request from a genuinely missing session or family. The page offers a retry for loading errors; its photo draft and crop are not reset by retrying. Loading errors are kept separate from upload/save feedback.

Family administration now checks Auth, membership and family-name errors before replacing displayed data. A failed refresh preserves the last confirmed family. The unused family_permissions read was removed: only the confirmed Admin role controls these management actions, with the existing RPC/RLS enforcement unchanged. A reload button is available beside errors.

Validation: 133 unit tests, TypeScript and production build. Regression cases cover transient Auth errors, failed membership queries, successful profile loading and actual missing-session access clearing. No schema changes, data deletion or new permissions. Physical mobile testing was not performed in this pass.
