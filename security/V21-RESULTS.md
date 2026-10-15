# TEST v21 — 2026-10-15

Build commit: 130cafd29d986643f71c0b9d4e2bc8aa7d7c453b
Workflow: https://github.com/thaerdj4-afk/fire-command/actions/runs/38711154546
APK SHA256: b24c8e869caae8652feaaa40b71322a29b3d5d2c343dcf6759b5370d87f36957
Artifact archive SHA256: 8b1f2f5417497b307ef0536cd4df65a8d7b9722ab6ce95bc8443043b0884c137

Changed only staging worker consent wording, version and release documentation.
Consent now explains location collection and sharing with HQ for incident coordination
and safety, minimized/locked-screen behavior, starting after consent and participation,
and the stop-sharing control. No live HQ source, policies or operational data changed.

Passed: all 20 worker browser tests locally and CI; CI admin checks, static security
gate, APK/unsigned AAB compilation, Android lint and Android 16 clean launch.
The 390px consent view is visible without horizontal overflow and was visually inspected.
Downloaded archive hash matches GitHub; APK embedded worker equals tested source.

v20 and v21 APK signing certificates differ. They cannot update in place. Removing the
old TEST staging app deletes its local identity and requires new enrollment/approval.
The production application ID is separate and must not be uninstalled for this test.

Not run: physical-phone GPS/SOS/background/message acceptance and push receipt/sound.
Firebase is not connected and client configuration is absent. No real push or SOS sent.
Production signing, Play listing/privacy completion and guarded legacy cutoff remain open.
Use DEVICE-ACCEPTANCE.md for physical-device evidence. This is not a Play-ready release.
