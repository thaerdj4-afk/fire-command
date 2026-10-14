# Approved workers and invitations

Workers request approval once. A server-generated 256-bit device credential is stored in private Android preferences (backup disabled), or browser local storage for web testing. The server stores only its hash. A name or phone number alone never authenticates a worker. The manager compares the displayed device fingerprint before approving the exact device. This is manual worker approval, not SMS phone-number verification.

An approved, unexpired device can list active events and join without an event code. Registration and invitation response never start GPS. Event participation still requires equipment selection and location consent; every GPS/message action uses a separately bound event session. Revoking approval revokes linked sessions, clears live positions and finishes only that device's participants. Guest event-code login remains supported.

HQ has a closed roster dialog with search, team/equipment invitation filters, and clickable response counters. Edited active-event names are saved so the app invitation uses the entered place. Invitations are idempotent, responses remain separate from push-provider acceptance, and a queued push is rechecked for current approval, active event and pending response before dispatch.

## Backend

Apply schema.sql, push-dispatch.sql, approval-lifecycle.sql and event-name.sql in that order. Direct anon/authenticated access to the new tables is revoked, RLS enabled, manager operations verify current HQ membership, and token-bearing queue RPCs are service-only. All functions have an empty search path. Existing worker/HQ functions and legacy policies are not removed by this feature.

The Edge Function worker-invitation-push requires a signed-in manager, validates the user against Auth and the current manager table, and uses service credentials only after that check. Platform verify_jwt remains enabled. No credentials, phone numbers, device bearer secrets or GPS are sent in notification payloads. Server signing keys must remain in managed secrets, never in the APK or repository.

## Firebase activation still required

The current test APK has the Messaging SDK, notification channel, permission button, token registration and notification-opening code. It has no Firebase client configuration, so closed-app push delivery and sound are not yet enabled or verified.

1. Add a Firebase Android app for com.firecommand.worker.staging and place its **public client configuration** in android-app/app/google-services.json. The Gradle file validates the package and embeds only public client identifiers.
2. Set FCM_SERVICE_ACCOUNT_JSON as a private Edge Function secret for a service account with permission to send FCM messages in the same Firebase project. Do not paste or commit the private key.
3. Rebuild with a higher version code, grant Android notification permission, enroll and approve a test device, then test foreground/background/closed-app receipt and sound on the real phone. Swiping away and force-stopping are different device states; do not promise notification delivery after force-stop.
4. Use a stable signing key before distributing update-in-place builds. This v20 debug APK has a different certificate from v18; Android will not install it as an update over that test build. Remove only the old staging test app if choosing to install v20. The production application ID is separate.

Production GPS/SOS/background proof, old-client migration and guarded legacy cutoff, production signing and Play publication remain release gates.
