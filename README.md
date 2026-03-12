
# ReleaseScribe – Changelog & Release Generator

Generate `CHANGELOG.md`, bump SemVer, and create GitHub Releases from Conventional Commits.

Commercial licensing: for production or paid use, see [Commercial Licensing](#commercial-licensing).

## Quick Start
```yaml
name: Release
on:
  push:
    branches: [ main ]
  workflow_dispatch:
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: zero-nonsense-dev/releasescribe-action@v1
        with:
          release-type: auto
          license-key: ${{ secrets.RELEASESCRIBE_LICENSE_KEY }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## License Enforcement
ReleaseScribe can enforce paid usage with runtime key validation.

```yaml
- uses: zero-nonsense-dev/releasescribe-action@v1
  with:
    license-key: ${{ secrets.RELEASESCRIBE_LICENSE_KEY }}
    license-api-url: https://api.releasescribe.dev/v1/licenses/validate
    license-fail-open: "false"
```

Recommended behavior:
- Keep `license-fail-open` as `false` in production.
- Store `license-key` in repository or organization secrets.
- Rotate compromised keys and revoke them server-side.

## Server-Side Core Mode
For stronger protection, keep release intelligence server-side and run this action
as a thin client.

```yaml
- uses: zero-nonsense-dev/releasescribe-action@v1
  with:
    execution-mode: remote
    core-api-url: https://api.releasescribe.dev/v1/release-plan
    core-api-token: ${{ secrets.RELEASESCRIBE_CORE_API_TOKEN }}
    license-key: ${{ secrets.RELEASESCRIBE_LICENSE_KEY }}
```

In `remote` mode, this action sends commit/file context to your API and expects a
release plan response. See `docs/backend-contract.md` for the contract.

## Inputs
- `release-type`: auto|patch|minor|major (default auto)
- `changelog-path`: path for CHANGELOG.md (default CHANGELOG.md)
- `prev-tag` / `next-tag`: manual overrides
- `dry-run`: true|false (default false) - compute and log without modifying repo
- `license-key`: paid license key (or use `RELEASESCRIBE_LICENSE_KEY`)
- `license-api-url`: key validation endpoint
- `license-fail-open`: continue on validation errors (default false)
- `execution-mode`: `local` or `remote` (default local)
- `core-api-url`: release planning endpoint for remote mode
- `core-api-token`: bearer token for remote mode
- `core-api-timeout-ms`: remote API timeout in ms (default 15000)

## Outputs
- `next_version`: computed tag (e.g., v1.2.3)

## License
This project is licensed under the Business Source License 1.1 (BUSL-1.1).

Commercial or production use requires a paid commercial license from the Licensor.
See [LICENSE](LICENSE) for full terms and the Change Date after which the code
transitions to Apache License 2.0.

Licensing inquiries: opensource@zerononsense.dev

## Commercial Licensing
Production and commercial use require a paid commercial license from Zero Nonsense Dev.

Contact: opensource@zerononsense.dev for terms and pricing.
