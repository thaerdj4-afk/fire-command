# Legacy access cutoff — NOT EXECUTED

The live HQ and `main` must remain operational. Current Android production and
`main/worker.html` still use anonymous table access. Revoking it immediately would
break those workers. The secure client alone does not protect the legacy API.

## Required before cutoff

1. Pass secure Android build/lint, emulator and real-device foreground/background GPS,
   SOS, inbox, photo, event finish, remote stop and revoked/expired-session tests.
2. Deliver the secure app to all active workers; verify no old app remains in use.
3. Test authenticated admin SELECT/INSERT/UPDATE and realtime delivery to HQ using
   a separate test project. Confirm `public.is_admin()` with actual approved users.
4. Resolve duplicate-name inbox addressing. Live HQ currently sends messages and
   remote-stop commands with `worker_name` only; secure inbox retains that compatibility.
   Worker-ID messages require a separately reviewed HQ change, outside this task's
   permission to preserve the live HQ.
5. Add gateway throttling for access-code attempts. Event-only throttling can be
   abused to deny legitimate access. The database code endpoint must not remain
   directly callable if a gateway is meant to enforce IP/device throttling.
6. Archive existing policy/function privileges, identify ALL callable legacy
   SECURITY DEFINER write/read functions, and rehearse exact rollback in isolation.

## Policies identified on 2026-10-13

- `workers`: `worker_insert`, `worker_read_own_insert`, `worker_update` (`anon`).
- `worker_requests`: `request_insert` (`anon`),
  `request_insert_authenticated` (any authenticated user).
- Preserve `admin_workers`, `admin_requests_read`, `command_update_requests` and
  all authenticated admin policies on `fire_events`.
- `worker_bind_secure_session(uuid,uuid,text)` lets a new token bind an arbitrary
  existing worker; secure registration does not use it. Revoke it after checking
  dependencies. Legacy name-based `worker_inbox` must be included in cutoff.

No policy revocations, legacy-function replacements, HQ edits, production deploys,
or merges were performed by this staging continuation.
