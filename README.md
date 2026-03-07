
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
MIT
