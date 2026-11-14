# Environment and deployment baseline — BE

This repo is the backend Vercel project. Its Vercel Root Directory is the repository root and the serverless entry is `api/index.js`.

Environment files contain names only. Put values in local untracked `.env` files or Vercel Environment Settings. Never commit values.

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

Storage and Cron are not configured in the foundation phase.

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
