# Google Play release preparation — blocked

## Build configuration

- Test application ID: `com.firecommand.worker.staging`. It installs separately
  from the current production APK, preventing test builds from overwriting it.
- API target/compile: 36; min SDK: 26; Java 17; AGP 8.10.1; Gradle 8.11.1.
- Staging workflow embeds the exact checked-out `worker.html` as an HTTPS-origin
  WebViewAssetLoader asset. No production website is loaded as the app UI.
- Debug APK is for testing. Generated release AAB is **unsigned and staging-only**.
- No signing keys or worker session tokens are committed. Android backup is disabled.
- Native foreground location service uses session-bound RPCs; token remains in RAM.
  OS service kill requires reopening the app, validating the saved web session and
  restarting sharing. There is no automatic credential-free service restart.

## Device test evidence required

Record APK SHA/commit, device model, OS version, WebView version and each result:

| Test | Required result | Current evidence |
|---|---|---|
| Clean install and app launch | Embedded branch login opens | Pending device |
| Permission denied / approximate / precise | Honest state; allowed mode works | Pending device |
| GPS with screen on and locked for 10 min | HQ receives fresh coordinates | Pending device |
| Revoke/expire session while sharing | No new coordinate writes | 17 backend rollback tests pass; device pending |
| SOS with/without GPS and with network failure | No false success; HQ receives alert | Browser mocks and backend rollback pass; device pending |
| HQ message/reply/sector and acknowledgment | Correct worker receives it | Browser/backend pass; duplicate-name blocker |
| HQ stop and event finish | Tracking stops; cannot restart without authority | Browser/backend pass; device pending |
| Switch event while permission dialog pending | No old event GPS write | Pending device |
| Process death/reopen | Revalidation before sharing resumes | Pending device |
| Camera/gallery/cancel | Valid photo or clean cancellation | Pending device |
| Offline/reconnect | No fake live state or duplicate SOS | Pending device |

## Production publication gate

1. Complete legacy cutoff prerequisites; no public table access or impersonation RPCs.
2. Complete real-device tests and signed-production AAB verification.
3. Use the intended production application ID and existing signing lineage; verify
   certificate against installed APK before promising an update without reinstalling.
4. Configure Play App Signing and upload key through protected CI secrets.
5. Provide privacy policy URL, data retention/deletion process, Data Safety answers
   for name, phone, precise location, messages and submitted photos, and app-access
   review credentials for a dedicated demonstration event without real worker data.
6. Complete any account-specific Play Console verification and required testing track.
7. Validate foreground location service declaration and consent wording; do not claim
   WhatsApp sending unless an authorized messaging integration actually exists.
8. Add store icon, screenshots, Hebrew/Arabic listing, support contact and release notes.

Official references checked 2026-10-13:
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://developer.android.com/build/releases/agp-8-10-0-release-notes
- https://developer.android.com/develop/ui/views/layout/webapps/load-local-content

This file is a preparation checklist, not approval or a claim of Play readiness.
