# ReleaseScribe Backend Contract

This file defines the HTTP contracts used by license enforcement and remote core mode.

## 1) License Validation Endpoint

- Method: `POST`
- URL: `https://api.releasescribe.dev/v1/licenses/validate`
- Headers:
  - `content-type: application/json`
  - `x-license-key: <license-key>`

Request body:

```json
{
  "licenseKey": "lic_...",
  "owner": "zero-nonsense-dev",
  "repo": "releasescribe-action",
  "runId": "123456789",
  "workflow": "Release"
}
```

Success response (`200`):

```json
{
  "valid": true,
  "message": "ok",
  "entitlements": {
    "remoteCore": true,
    "plan": "pro"
  }
}
```

Failure response:

- `401` or `403` for invalid/revoked key.
- `429` for rate limits.
- `5xx` for transient backend errors.

## 2) Remote Release Planning Endpoint

- Method: `POST`
- URL: `https://api.releasescribe.dev/v1/release-plan`
- Headers:
  - `content-type: application/json`
  - `authorization: Bearer <core-api-token>` (recommended)

Request body:

```json
{
  "owner": "zero-nonsense-dev",
  "repo": "releasescribe-action",
  "defaultBranch": "main",
  "lastTag": "v1.0.0",
  "nextTagOverride": null,
  "releaseType": "auto",
  "monorepo": false,
  "packagesGlob": "packages/*",
  "commits": [
    { "sha": "abc123", "subject": "feat: ...", "body": "...", "scopes": ["pkg-a"] }
  ],
  "files": ["src/index.ts"]
}
```

Success response (`200`):

```json
{
  "nextVersion": "v1.1.0",
  "rootSection": "## v1.1.0 - 2026-03-10\n\n### Features\n- feat: ... (abc123)",
  "releaseBody": "## v1.1.0 - 2026-03-10\n\n### Features\n- feat: ... (abc123)",
  "packageSections": {
    "pkg-a": "## v1.1.0 - 2026-03-10\n\n### Features\n- feat(pkg-a): ..."
  }
}
```

Required response fields:

- `nextVersion` (string)
- `rootSection` (string)

Optional response fields:

- `releaseBody` (string)
- `packageSections` (record of package name -> markdown section)

## Security Recommendations

- Bind license keys to owner/repo and enforce tenancy checks.
- Implement per-key and per-IP rate limits.
- Log validation and planning requests for abuse monitoring.
- Return deterministic, bounded payload sizes.
- Keep all business logic and premium heuristics server-side.
