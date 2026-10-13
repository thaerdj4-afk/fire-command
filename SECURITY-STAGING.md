# Worker security staging

This branch is isolated from production `main` and the live HQ.

## Verified backend preparation
- Event access codes stored as password hashes in `worker_event_access_codes`.
- Session tokens stored hashed in `worker_access_sessions`.
- Attempt tracking in `worker_access_attempts`.
- RPCs: `verify_worker_event_access`, `worker_start_secure_session`, `worker_secure_session_valid`, `worker_bind_secure_session`, `worker_secure_session_worker_valid`, `worker_secure_update_location`.

## SECURITY BLOCKERS — DO NOT DEPLOY TO PLAY
- Anonymous `workers` SELECT and UPDATE policies currently allow `true`, exposing names, phone numbers and GPS.
- Anonymous `worker_requests` INSERT permits arbitrary requests.
- Legacy `worker_inbox` uses worker name without session authorization.
- Worker frontend uses legacy direct database calls, not secure RPCs.
- The session-binding RPC must not be exposed to arbitrary existing worker IDs: replace it with a single atomic, server-side join/registration flow before rollout.
- Rate limiting keyed only by event number is insufficient for distributed brute-force protection; add IP/device throttling at an edge gateway.
- No completed Android signed AAB, real-device testing, penetration testing, or Play Store review.

Never store secrets or Android signing keys in this repository. Do not merge until the full worker data flow is protected and verified.