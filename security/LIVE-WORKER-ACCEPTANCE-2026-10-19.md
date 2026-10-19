# Live worker button acceptance — 2026-10-19

Tested the embedded worker.html extracted from the actual v23 download APK, against real Supabase RPCs (a local HTTP transport proxy only; no mocked RPC responses). Used dedicated QA event 100055 and a synthetic approved device with no push token. No real worker invitations or push notifications were sent.

Passed by browser interaction and database verification: approved event listing without GPS, code-free joining after consent, status change, fuel/water/food/reinforcement requests, SOS, seeded targeted HQ message display and acknowledgment, synthetic image submission, stop sharing and finish participation. Each submitted request type and acknowledgment appeared exactly once. Finish set worker status to ended and left coordinates null.

Geolocation watch was stubbed without coordinates: this does NOT verify physical GPS, Android foreground/background service or locked-screen behavior. Notification delivery/ringtone, native camera and other unexercised device controls remain unverified. The first harness completed app actions but logged a teardown socket error; the second phase waited for pending routes and exited successfully.

Cleanup verified: event 100055 ended, zero active QA workers, zero open QA requests; QA device expired/revoked and QA sessions revoked. Test records retained as labelled history; no production records deleted.
