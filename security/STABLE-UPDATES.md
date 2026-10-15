# Stable update preparation

This branch prepares v23 for direct APK updates. It is not yet a built or distributed release.

- The application ID remains `com.firecommand.worker.staging`, matching Firebase v22.
- v23 must be signed using the private persistent key stored in the owner's `android-signing.json` backup. Never commit or publish that file.
- Add its complete contents to the repository Actions secret `ANDROID_SIGNING_JSON`.
- Run `Build stable signed worker` on this branch. The build fails closed without the secret.
- Verify the signed APK, then test installation and FCM on a physical device. v22 debug cannot be upgraded using the new release signer; one final reinstall/reapproval may be needed.
- Install a second higher-version APK signed with the same key over v23 and verify worker registration survives before promising the rollout.
- Only after verification replace the APK on the existing download Site and publish `/updates.json` containing `packageName`, `versionCode`, and `versionName` for the APK actually available there. Never publish an offered version before its APK is available.
- Native checks use a fixed HTTPS origin with timeouts, bounded parsing, no redirects, no remote executable code, and a user-confirmed browser download. Offline failures never interrupt work. Current embedded UI still requires APK updates; there is no automatic web-code replacement.
- There is no silent installation and no change to Play Protect.
