# Worker v18 and HQ fixes — 2026-10-14

Build commit: 54b1bbb3348d874fd5e70d70bc79a299bdde004c
Workflow: https://github.com/thaerdj4-afk/fire-command/actions/runs/38624587659
APK SHA256: dc741c06bed583fb9e4e45847d5153defe92e206840fe966ed6f9394bbbfe864

- 14 rollback database checks passed, including numeric secure-session start, previous-code rejection, preserved existing sessions, and 20-failure limit.
- 11 HQ widget browser checks passed, including exact eight-digit copying and typed event name in WhatsApp draft.
- 16 worker browser and 3 admin tests passed; APK compilation, AAB and lint passed.
- 3 HQ event-scope checks passed: no unscoped historical workers, only current-event unfinished markers, stale response discard on switch/closure.
- APK embedded worker bytes match tested worker.html.
- Backend migration applied: HQ generates eight-digit cryptographic numeric codes; legacy long codes still accepted until rotated. Existing worker sessions are never revoked by HQ code refresh.
- Eitan database evidence belongs to ended events 100031 and 100036. No historical rows deleted. HQ loading/rendering corrected.
- Android16 clean-launch workflow status is available in linked run. Actual device GPS/SOS/background and production signing remain release gates. Debug builds do not have guaranteed stable signing across runs.

Android 16 corrected smoke run passed: https://github.com/thaerdj4-afk/fire-command/actions/runs/38625429143
The exact original v18 APK was installed and verified: secure login visible, no location service before authorization, no main-thread fatal exception. Initial smoke automation failed on a missing ripgrep dependency and logcat command; portable Python checks and retried adb shell logcat fixed the harness.
