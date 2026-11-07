# Child-account status and invitation refresh — 7 November 2026

The child-login editor now requires a successfully loaded status before creating or resetting a login. A failed read displays an unknown-status message instead of “no login yet”, and leaves the last confirmed data and form draft intact. Background refresh keeps the editor mounted; controls are disabled during loading. Request versions discard stale responses after retry/unmount.

Loading and action errors are separate. A successful account change followed by a failed family refresh is reported as a saved change with an outstanding refresh, not as a failed password change. Existing Edge Function authorization, guardian acknowledgement and password rules remain unchanged.

The invitation refresh button now locks duplicate requests, handles a rejected family callback and always releases controls. It does not issue a new invitation or discard the current link merely to refresh status.

Validation: 139 unit tests, TypeScript and production build pass. Added six cases for failed/empty child status, blocked saves without known status, invitation callback failure, failed-load handling and duplicate refreshes. No schema changes, credential resets, invitation sends or user-data deletion were performed during this pass. Physical mobile interaction remains unverified.
