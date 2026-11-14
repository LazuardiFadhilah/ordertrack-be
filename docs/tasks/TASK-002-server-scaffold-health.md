# TASK-002 — Server scaffold and health endpoint

Status: `MERGED`
Owner: `BE`
Branch: `feat/TASK-002-server-scaffold-health`

## Scope

Create the Express server foundation and implement `GET /api/health` exactly as defined in `docs/API.md`.

## Out of scope

- Authentication
- MongoDB models or migrations
- Domain endpoints
- Client changes

## Acceptance criteria

- [x] Isolated Node.js ES-module package with reproducible install and start/check commands.
- [x] Express app separated from serverless entry at `api/index.js`.
- [x] `GET /api/health` returns HTTP 200 and the contracted shape.
- [x] Malformed or unknown routes return the standard error shape without a stack trace.
- [x] Environment parsing has a place for MongoDB, JWT, and storage settings; no secret committed.
- [x] Mongoose connection caching is scaffolded without requiring Atlas for health.
- [x] Runnable tests prove the health response.

## Evidence

- Commit: `9823e39 feat(server): scaffold health endpoint [TASK-002]`
- QA: `docs/QA-REPORT-002.md`
