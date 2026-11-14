# Environment and deployment baseline — BE

This repo is the backend Vercel project. Its Vercel Root Directory is the repository root and the serverless entry is `api/index.js`.

Environment templates contain variable names only. Put values in a local untracked `.env` file or Vercel Environment Settings. Never commit secrets, connection strings, tokens, or passwords.

## Variables

| Variable | Scope | Purpose |
|---|---|---|
| `MONGODB_URI` | Server runtime secret | MongoDB Atlas connection string |
| `JWT_SECRET` | Server runtime secret | JWT signing secret |
| `JWT_EXPIRES_IN` | Server runtime configuration | JWT lifetime |
| `AUTH_COOKIE_NAME` | Server runtime configuration | httpOnly auth cookie name |
| `AUTH_COOKIE_SECURE` | Server runtime configuration | Secure cookie behavior |
| `CORS_ORIGIN` | Server runtime configuration | Allowed direct API origin |
| `PORT` | Local runtime only | Local HTTP port |
| `STORAGE_PROVIDER` | Future | Storage provider selector |
| `STORAGE_BUCKET` | Future | Storage bucket/container |
| `STORAGE_REGION` | Future | Storage region |
| `STORAGE_ENDPOINT` | Future | Storage API endpoint |
| `STORAGE_ACCESS_KEY_ID` | Future secret | Storage access identifier |
| `STORAGE_SECRET_ACCESS_KEY` | Future secret | Storage access secret |
| `CRON_SECRET` | Future secret | Vercel Cron protection |

Authentication configuration:

- `JWT_SECRET` is required at runtime for signing authentication tokens. Use a long, random, non-placeholder value in production; do not use the blank template value or a sample string.
- `JWT_EXPIRES_IN` is the JWT lifetime accepted by the authentication implementation. Set it explicitly in each environment.
- `AUTH_COOKIE_NAME` is the httpOnly cookie name used for authentication. Keep the same name across the client and server deployment settings.
- `AUTH_COOKIE_SECURE` controls the cookie `Secure` attribute. Disable it only for local HTTP development and enable it for production HTTPS. Production must use secure cookies.

For local development, copy `.env.example` to `.env` and configure the blank names for the local server. For Vercel production, configure the same variable names in Server Project → Settings → Environment Variables, use a non-placeholder `JWT_SECRET`, and enable `AUTH_COOKIE_SECURE`.

Storage and Cron are not configured in the foundation phase.

## Configuration and secret scan

Run this from the repository root before committing. It checks that `.env.example` contains the required names with blank values, rejects tracked local env files, and scans tracked text for credential-bearing URI/private-key patterns:

```bash
python3 - <<'PY'
import pathlib
import re
import subprocess

required = {
    'MONGODB_URI', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'AUTH_COOKIE_NAME',
    'AUTH_COOKIE_SECURE', 'CORS_ORIGIN', 'PORT', 'STORAGE_PROVIDER',
    'STORAGE_BUCKET', 'STORAGE_REGION', 'STORAGE_ENDPOINT',
    'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY', 'CRON_SECRET',
}
text = pathlib.Path('.env.example').read_text()
entries = {}
for line in text.splitlines():
    if not line or line.startswith('#'):
        continue
    name, sep, value = line.partition('=')
    if sep:
        entries[name] = value
assert set(entries) == required, f'unexpected env names: {set(entries) ^ required}'
assert all(value == '' for value in entries.values()), 'non-blank value in .env.example'
tracked = subprocess.check_output(['git', 'ls-files', '-z'], text=False).decode().split('\0')
assert not [path for path in tracked if pathlib.PurePosixPath(path).name in {'.env', '.env.local'}], 'tracked local env file'
patterns = [r'mongodb(?:\+srv)?://[^\s`"<>]+', r'-----BEGIN [A-Z ]+ PRIVATE KEY-----']
for path in filter(None, tracked):
    data = pathlib.Path(path).read_text(errors='ignore')
    assert not any(re.search(pattern, data) for pattern in patterns), f'credential pattern in {path}'
print('config/secret scan: PASS')
PY
```

## Local commands

```bash
npm ci
npm run check
npm test
npm start
```

## Vercel

- Framework preset: Other
- Install Command: `npm install`
- Build Command: `npm run check`
- Serverless entry: `api/index.js`
- `vercel.json` routes requests to `api/index.js`.
- No production deployment is part of the foundation phase.
