# TEST v22 Firebase client — 2026-10-15

Build: 117a7792996c7a72ecd8c53866f06053226ea348
Workflow: https://github.com/thaerdj4-afk/fire-command/actions/runs/38804993979
APK SHA256: cc675b50248d9b7146450bd49208029a71606ddfeee52c149f13d67a450079e2
Artifact archive SHA256: e5b63b3d913b88f787bcacde19dcda1645a6256903441c5249705c665b5f48d8

The uploaded public google-services.json matches com.firecommand.worker.staging and
fire-command-worker. No service-account key was uploaded or committed. The APK's
compiled resources contain the matching project/app/sender/public API identifiers.
Embedded worker bytes match the tested source exactly; artifact digest matches GitHub.

Passed: static security gate, push-dispatch mocks, CI browser checks, APK/unsigned AAB
compilation, lint and Android 16 clean launch/no pre-auth location service/no fatal crash.
Firebase token registration and actual phone receipt/sound remain unverified. Server
FCM_SERVICE_ACCOUNT_JSON is still required through a protected secret-setting path.
No real invitation push or SOS was sent by these tests. Live HQ source/data unchanged.

v21 and v22 staging debug signing certificates differ; installing requires removal of
only the previous TEST app and fresh device enrollment/approval. Do not remove the
production app. Production signing/Play and physical GPS/SOS acceptance remain open.
