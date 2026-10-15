# Physical-device acceptance — TEST v20

Status: NOT RUN. Do not populate results from browser mocks or emulator launch.
Use a dedicated demonstration event and consenting test worker; never trigger a real
operational SOS or broadcast. Keep the live HQ and active operational events unchanged.

Artifact SHA256: 897b224ba4da7c5980b2f1522fe511b3f5250eba34d4b8ec33345a0def4d383d
Build commit: f79a6e28b55249c86f9db0b4b03d72a7feb37abe
Package: com.firecommand.worker.staging
Device / Android / WebView / tester / local time: UNRECORDED
Only the previous TEST staging copy may need removal for a certificate mismatch.
Do not uninstall the production app. Removing TEST also removes its device identity;
a fresh installation requires a new device approval.

| Action in demonstration event | Evidence required | Result |
|---|---|---|
| Launch without joining | No location service or HQ coordinate | NOT RUN |
| Enroll and remain pending | No event access; fingerprint matches HQ | NOT RUN |
| Approve exact device | Active events available without code | NOT RUN |
| Decline invitation | Correct pending/declined count, no GPS | NOT RUN |
| Select event, do not consent | No location service or coordinate | NOT RUN |
| Consent with permission denied | Honest error; no fake live state | NOT RUN |
| Allow approximate, then precise location | Accurate permission state and timestamp | NOT RUN |
| Share screen-on, minimized and locked for 10 minutes each | Fresh HQ timestamps; persistent service notification | NOT RUN |
| Stop sharing; restart only with consent | HQ point cleared; no unsolicited restart | NOT RUN |
| SOS with GPS, without GPS and offline | Matching HQ request or explicit failure; no false success | NOT RUN |
| HQ targeted message and acknowledgment | Correct worker only, including duplicate-name test worker | NOT RUN |
| Revoke approval during sharing | Sessions rejected, GPS stopped and map point cleared | NOT RUN |
| Finish event | Joining denied and location stops | NOT RUN |
| Kill/reopen app | Session revalidated before location restart | NOT RUN |
| Photo selection/cancel and offline/reconnect | Clean cancellation; no duplicate requests | NOT RUN |
| Push permission denied/allowed | Honest UI; no silent permission assumption | BLOCKED: FIREBASE |
| Invite with app foreground/background/swiped away | Correct place, audible channel, tap opens correct event | BLOCKED: FIREBASE |
| Tap push before consent | Event opens; no automatic GPS | BLOCKED: FIREBASE |

FCM provider acceptance is not proof of phone delivery. Record receipt and sound on
the physical phone separately. Force-stop is distinct from swiping away and may block
notifications until the app is reopened. Keep evidence free of real worker phone numbers,
coordinates and credentials. Remove demonstration data only through the normal test flow.
