
# ReleaseScribe – Changelog & Release Generator

Generate `CHANGELOG.md`, bump SemVer, and create GitHub Releases from Conventional Commits.

Commercial use note: production or paid usage requires a commercial license. See [Commercial Licensing](#commercial-licensing).

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
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs
- `release-type`: auto|patch|minor|major (default auto)
- `changelog-path`: path for CHANGELOG.md (default CHANGELOG.md)
- `prev-tag` / `next-tag`: manual overrides
- `dry-run`: true|false (default false) - compute and log without modifying repo

## Outputs
- `next_version`: computed tag (e.g., v1.2.3)

## License
This project is licensed under the Business Source License 1.1 (BUSL-1.1).

Commercial or production use requires a paid commercial license from the Licensor.
See [LICENSE](LICENSE) for full terms and the Change Date after which the code
transitions to Apache License 2.0.

Licensing inquiries: opensource@zerononsense.dev

## Commercial Licensing
To use ReleaseScribe in production or for commercial purposes, request a paid
commercial license.

Please include the following in your request:
- Company name
- Intended usage (internal, SaaS, on-prem, etc.)
- Estimated repositories or workflows using this action
- Desired support level and response time

Contact: opensource@zerononsense.dev
