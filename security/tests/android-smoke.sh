#!/usr/bin/env bash
set -euo pipefail
mkdir -p smoke-evidence
apk_path=$(find staging-build -name app-debug.apk -print -quit)
test -n "$apk_path"
adb install "$apk_path"
adb shell am start -W -n com.firecommand.worker.staging/com.firecommand.worker.MainActivity
passed=false
for attempt in $(seq 1 10); do
  adb shell uiautomator dump /sdcard/worker-window.xml
  adb pull /sdcard/worker-window.xml smoke-evidence/worker-window.xml
  if python3 - <<'PY'
from pathlib import Path
import xml.etree.ElementTree as ET
root=ET.parse('smoke-evidence/worker-window.xml').getroot()
labels=' '.join((node.get('text','')+' '+node.get('content-desc','')) for node in root.iter())
assert 'הצטרפות לאירוע' in labels, 'Embedded worker entry screen is missing'
assert 'קוד גישה' in labels, 'Secure code entry is missing'
print('PASS Android 16 launches embedded secure login')
PY
  then passed=true; break; fi
  sleep 2
done
$passed
adb shell dumpsys activity services com.firecommand.worker.staging > smoke-evidence/services-before-login.txt
if python3 - <<'PY_CHECK'
import re
from pathlib import Path
raise SystemExit(0 if re.search(r'ServiceRecord.*LocationService',Path('smoke-evidence/services-before-login.txt').read_text()) else 1)
PY_CHECK
then
  echo 'FAIL location service started without authentication'
  exit 1
fi
echo 'PASS Android location service remains stopped before secure login'
adb shell screencap -p /sdcard/worker-entry.png
adb pull /sdcard/worker-entry.png smoke-evidence/worker-entry.png
logs_ok=false
for log_attempt in 1 2 3; do
  if adb shell logcat -d -t 2000 > smoke-evidence/logcat.txt; then logs_ok=true; break; fi
  sleep 2
done
$logs_ok
if python3 - <<'PY_CHECK'
import re
from pathlib import Path
raise SystemExit(0 if re.search(r'FATAL EXCEPTION.*main',Path('smoke-evidence/logcat.txt').read_text()) else 1)
PY_CHECK
then
  echo 'FAIL Android crash detected'
  exit 1
fi
echo 'PASS Android clean launch has no main-thread fatal exception'
echo 'Device GPS/SOS/background tests are still required.'
