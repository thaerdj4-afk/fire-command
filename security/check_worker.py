#!/usr/bin/env python3
"""Static security gate for the worker client. Fails closed until direct anonymous DB operations are removed."""
from pathlib import Path
import re
import sys

worker = Path(__file__).resolve().parents[1] / "worker.html"
source = worker.read_text(encoding="utf-8")
checks = {
    "Event secret input exists": 'id="eventSecret"' in source,
    "Secure session RPC called": "worker_start_secure_session" in source,
    "No anonymous worker table reads/writes": not bool(re.search(r"cloud\.from\(['\"]workers['\"]\)", source)),
    "No anonymous request table reads/writes": not bool(re.search(r"cloud\.from\(['\"]worker_requests['\"]\)", source)),
    "No legacy name-based inbox": "worker_inbox" not in source,
    "No legacy event lookup without code": "worker_event_by_number" not in source,
    "Secure session checked on GPS updates": "worker_secure_update_location" in source,
}
native = worker.parent / "android-app/app/src/main/java/com/firecommand/worker"
service = (native / "LocationService.java").read_text()
activity = (native / "MainActivity.java").read_text()
checks.update({
    "Native GPS uses secure session RPC": "worker_secure_update_location" in service and '"p_session_token"' in service,
    "Native GPS has no direct table endpoints": not re.search(r"/rest/v1/(workers|worker_requests)(?:[?\"/])", service),
    "Android loads embedded worker asset": "WebViewAssetLoader" in activity and "appassets.androidplatform.net/assets/worker.html" in activity,
    "Legacy native bridge removed": "public void startLocation(" not in activity and "public void resumeLocation(" not in activity,
    "Native service cannot restart without credentials": "return START_STICKY" not in service,
    "Worker has no remote script dependencies": '<script src=' not in source,
})
for title, ok in checks.items():
    print(("PASS" if ok else "BLOCK") + " " + title)
if not all(checks.values()):
    print("NOT READY FOR RELEASE: security gate failed.")
    sys.exit(1)
print("Static security gate passed. Live authorization and device tests still required.")
