# Worker security staging

Branch: `worker-security-staging`. Production `main` and live HQ files remain unchanged.

## Continuation on 2026-10-13

- Secure browser client uses session-bound registration, profile, location, requests,
  status, finish and inbox RPCs. No direct worker/request table operations.
- Android sources are tracked. The staging APK embeds the checked-out worker asset
  and installs as `com.firecommand.worker.staging` separately from production.
- Native GPS now uses the bound worker ID + token with secure RPCs, without persisting
  token in native preferences or automatically restarting without credentials.
- Worker registration and GPS backend runtime errors were reproduced and fixed in
  secure RPCs only (`pg_catalog.nullif` and nonexistent `isfinite(float8)`).
- Server rejects coordinate updates while an active HQ stop command exists.
- Backend: 14 rollback-only tests pass after the secure RPC fixes were applied.
  No test event, worker, message or SOS was committed or broadcast to live HQ.
- Browser: 13 behavioral tests passed locally using Chromium headless shell.
  See `security/tests/worker-browser.cjs` and Actions execution results.
  Mock-browser tests do not replace native or real-device tests.

## Release blockers

- Legacy anonymous workers SELECT/INSERT/UPDATE and requests INSERT remain open.
  `request_insert_authenticated` allows any authenticated user to insert requests.
- Legacy name-based inbox remains callable. Arbitrary session binding was inspected:
  execution is already denied for both anonymous and authenticated roles.
- Duplicate names can receive another worker's legacy HQ message; live HQ currently
  addresses messages/stop commands by name. It is preserved per user instruction.
- Secure request type validation and IP/device gateway throttling require completion.
- Real Android device tests, signed production AAB, signing-lineage verification,
  Play Console declarations and privacy policy are incomplete.

The branch is not ready for Google Play or production rollout. See
`security/legacy-cutoff-plan.md` and `security/PLAY-RELEASE.md`.
Never commit secrets or signing keys. Do not merge until blockers are resolved.
