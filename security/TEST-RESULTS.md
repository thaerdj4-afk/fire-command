# Worker security continuation — verified 2026-10-13

Tested source commit: `6c6067d8bc3ba46e8193de272ba6cb0fe55ed41c`.
Branch: `worker-security-staging`.

[Successful Android build and smoke run](https://github.com/thaerdj4-afk/fire-command/actions/runs/38467024432)

## Passed

- 17 PostgreSQL behavior tests, including registration, bound-worker authorization,
  coordinates/NaN/infinity rejection, SOS, HQ inbox, HQ stop, finish, revocation,
  expiry, closed events, and rejection of worker-forged HQ messages/commands.
- 3 checks under the actual `anon` database role: invalid sessions denied,
  forged SOS denied, arbitrary legacy binding EXECUTE denied.
- 3 real HTTPS RPC checks without Authorization header (publishable apikey only):
  invalid-session validation returned false; profile and inbox returned empty lists.
- 15 browser behavioral tests: initial login, consent, bad codes, phone normalization,
  secure GPS and native bridge, SOS, failed/offline SOS, message rendering/ACK,
  revocation, remote stop, event closure and finish.
- 13 static checks across browser and native GPS code.
- Android APK compilation, unsigned staging AAB generation and Android lint.
- Android 16 emulator: embedded secure login visible; location service stopped before
  authentication; no main-thread fatal exception at clean launch.

Build artifact: `Fire-Command-Worker-SECURITY-STAGING-6c6067d8bc3ba46e8193de272ba6cb0fe55ed41c`.
Emulator evidence: `Android-36-smoke-evidence-6c6067d8bc3ba46e8193de272ba6cb0fe55ed41c`.
Both are available on the run page above. Install the **debug APK**, not the AAB.
This test package installs separately as `com.firecommand.worker.staging`.

## Backend changes actually applied

Only secure worker RPCs were changed:

- `worker_secure_register`: remove invalid schema-qualified NULLIF call.
- `worker_secure_update_location`: replace nonexistent float isfinite calls with
  bounded validation; enforce active HQ location-stop commands.
- `worker_secure_send_request`: restrict worker request types, preventing workers
  from forging HQ messages, stop commands or sector assignments through this RPC.

Test fixtures were rolled back. No test event, worker, location or SOS was committed.
No live event code was rotated, no active session was deliberately revoked, and no
legacy policy was removed. `worker_bind_secure_session` was already unavailable to
anon/authenticated on inspection; no new change to it was needed.

Production `main` was verified unchanged at
`fd34978428186e9dee5263872069e853fa91deb6`; `index.html` is byte-for-byte unchanged.

## Not yet verified / release blockers

- Real-phone precise/approximate GPS, background/locked-screen behavior, process
  death, permission changes, native camera/gallery and live delivery to HQ.
- Legacy anonymous table access and legacy inbox still bypass the secure path.
  Cutoff must follow worker migration to preserve the current field system.
- HQ still addresses some messages by worker name, so duplicate-name safety is
  unresolved without a separately reviewed HQ change.
- IP/device throttling for access-code entry is still required.
- Production signing lineage, signed production AAB, Play Console declarations,
  privacy policy, app-access review credentials and store assets are incomplete.

The emulator test is a clean-launch smoke test, not proof of native GPS/SOS or
real-device readiness. This branch is not ready for production or Google Play.

See [release preparation](PLAY-RELEASE.md) and [legacy cutoff plan](legacy-cutoff-plan.md).


# Continuation verified 2026-10-14 — APK v16

Source commit: `b4ea27106b07d6aa9abfb70991462913d6a00333`.
[Successful v16 build, lint and Android 16 emulator run](https://github.com/thaerdj4-afk/fire-command/actions/runs/38615999497).

- 27 database rollback tests passed (17 baseline + 10 inbox/admin identity tests).
- 18 browser tests passed (15 worker + 3 admin page).
- APK compilation, unsigned staging AAB, Android lint and Android 16 clean-launch
  smoke checks passed. Native GPS/SOS on a real phone remain untested.
- APK v16 adds a recognizable flame icon and remains a separate staging package.
- APK SHA-256: `cb18ce28fb2629c5fdf86c4de56a9a7faf366ee20adbb9d2006345cb2f04ba10`.

Backend changes applied only to the new protected path:
- Protected inbox hides ambiguous name-only messages when active names repeat and
  hides legacy messages older than the worker's current participation.
- `admin_send_secure_worker_message` derives event and name from the worker ID on
  the server and requires an approved admin role. Anonymous EXECUTE is denied.
- Isolated `worker-access-admin.html` now displays worker IDs and sends through
  this protected manager endpoint. Test requests were rolled back, never broadcast.

Live `index.html` and `main` remain unchanged. Legacy anonymous table access and
legacy inbox are still open until worker migration and real-phone tests complete.
The prepared guarded cutoff SQL was not applied. IP/device gateway throttling,
production signing and Google Play publication still require completion.

The delivered APK is for installing and verifying the real-phone path. No claim
is made that locked-screen GPS, real SOS delivery or Play readiness has passed.
