"""CI-only: restore signing material without logging or committing it."""
import base64
import json
import os
from pathlib import Path

raw = os.environ.get('ANDROID_SIGNING_JSON', '')
if not raw:
    raise SystemExit('Add the ANDROID_SIGNING_JSON repository secret before building a stable release.')
try:
    data = json.loads(raw)
    required = ('keystore_base64', 'store_password', 'key_password', 'key_alias')
    if not all(isinstance(data.get(k), str) and data[k] for k in required):
        raise ValueError()
    if any('\n' in data[k] or '\r' in data[k] for k in required):
        raise ValueError()
    content = base64.b64decode(data['keystore_base64'], validate=True)
except Exception:
    raise SystemExit('Invalid signing configuration; secret values are hidden.') from None
key = Path(os.environ['RUNNER_TEMP']) / 'worker-release.jks'
key.write_bytes(content)
key.chmod(0o600)
for k in ('store_password', 'key_password', 'key_alias'):
    print('::add-mask::' + data[k])
with open(os.environ['GITHUB_ENV'], 'a') as out:
    for name, value in {
        'WORKER_KEYSTORE_PATH': str(key),
        'WORKER_STORE_PASSWORD': data['store_password'],
        'WORKER_KEY_PASSWORD': data['key_password'],
        'WORKER_KEY_ALIAS': data['key_alias'],
    }.items():
        out.write(name + '=' + value + '\n')
print('Private signing key restored for this build only.')
