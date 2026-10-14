# Trusted worker v20 verification

Build commit: f79a6e28b55249c86f9db0b4b03d72a7feb37abe
Successful workflow: https://github.com/thaerdj4-afk/fire-command/actions/runs/38635759124
APK SHA256: 897b224ba4da7c5980b2f1522fe511b3f5250eba34d4b8ec33345a0def4d383d

Passed:
- 25 rolled-back database approval/identity/session checks, 9 rolled-back queue checks, and 3 rolled-back name-edit checks. No fixture workers/events/invitations were committed.
- 20 worker browser behavioral checks and 3 isolated admin checks in CI; 4 trusted HQ browser scenarios locally (closed 30-worker roster, safe rendering/search, exact filter selection, response dialogs and logout cleanup).
- Push dispatcher authentication, manager authorization, missing-config no-send, truthful provider status, revocation exclusion, scoped payload and ephemeral OAuth signature tests. No real notification was sent.
- APK compilation, unsigned staging AAB, Android lint and Android 16 clean launch/no unauthenticated location service/no fatal main exception.
- Downloaded artifact archive digest matches GitHub, and embedded worker bytes match the tested source exactly.
- HTTP invalid-device profile returns null; unauthenticated push requests return 401.
- Local WorldCover grid integrity/classification and Chromium decompression/canvas overlay tests; fixed regional URLs send no fire coordinates. Weather labels pass phone/tablet/desktop layout checks; compact arrow tests cover cardinal directions and missing-direction behavior.

An initial v20 browser job caught an assertion racing the async decline response. The test now waits for the actual response, and the final CI run passes. The v19 preliminary build also passed but is not the delivered version.

Not verified/activated: Firebase client/server configuration and actual push receipt/sound, real-phone GPS/SOS/background behavior, production signing/Play and legacy cutoff. The delivered installer is TEST v20, not a production release. v20 and v18 debug certificates differ, so they cannot update in place.

Land cover is ESA WorldCover 2021, derived with categorical mode from 10 m source data to an approximately 100 m display grid. It is historical cover, not current fuel moisture or a live vegetation survey. The spread-potential indicator is an application heuristic, not a validated spread-rate model or measured metres.
