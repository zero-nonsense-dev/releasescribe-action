# ReleaseScribe – Changelog & Release Generator

Generate `CHANGELOG.md`, bump SemVer, and create GitHub Releases from Conventional Commits.

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
      - uses: zero-nonsense-dev/releasescribe-action@v2
        with:
          release-type: auto
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Server-Side Core Mode
Keep release intelligence server-side and run this action as a thin client.

```yaml
- uses: zero-nonsense-dev/releasescribe-action@v2
  with:
    execution-mode: remote
    core-api-url: https://api.releasescribe.dev/v1/release-plan
    core-api-token: ${{ secrets.RELEASESCRIBE_CORE_API_TOKEN }}
```

In `remote` mode, this action sends commit/file context to your API and expects a
release plan response. See `docs/backend-contract.md` for the contract.

## Inputs
- `release-type`: auto|patch|minor|major (default auto)
- `changelog-path`: path for CHANGELOG.md (default CHANGELOG.md)
- `prev-tag` / `next-tag`: manual overrides
- `dry-run`: true|false (default false) - compute and log without modifying repo
- `execution-mode`: `local` or `remote` (default local)
- `core-api-url`: release planning endpoint for remote mode
- `core-api-token`: bearer token for remote mode
- `core-api-timeout-ms`: remote API timeout in ms (default 15000)

## Outputs
- `next_version`: computed tag (e.g., v1.2.3)

## License
This project is licensed under the [Business Source License 1.1 (BUSL-1.1)](LICENSE).

Free to use. Source available. Transitions to Apache License 2.0 on the Change Date
specified in the LICENSE file.

Questions: opensource@zerononsense.dev
