
## New in v1.1.0

- **Unit tests** with Vitest (`npm test`)
- **Conventional commit presets** (built-in `conventional` preset, custom via `preset-path`)
- **Monorepo mode** (`monorepo: true`) with `packages/*` per-package changelogs + global release

### New Inputs
- `preset`: `conventional` (default) or leave blank and use `preset-path`
- `preset-path`: path to a JSON config with keys: `breakingIndicators`, `minorTypes`, `patchTypes`, `otherTypes`, `scopesIgnored?`, `headerPattern?`
- `monorepo`: `true|false` (default `false`)
- `packages-glob`: defaults to `packages/*`
