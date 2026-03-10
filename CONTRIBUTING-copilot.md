# CONTRIBUTING-copilot.md

> **Purpose**: This guide primes GitHub Copilot (and you) to work effectively on **ReleaseScribe – Conventional Commits → Changelog & Release**. It explains the project, how to run/tests, what to check, and how to propose changes. Paste the **Quick Copilot Kickoff** into Copilot Chat to get started.

---

## 1) Project in one minute

**What ReleaseScribe does**
- Reads **Conventional Commits** since the last tag and determines the next **SemVer** (`patch|minor|major`).
- **Prepends** a new section to `CHANGELOG.md` (Keep‑a‑Changelog style).
- **Creates a GitHub Release** with those notes.
- **Monorepo mode** (optional): also writes per‑package changelogs under `packages/*/CHANGELOG.md` and a global summary in the root.

**Inputs (action.yml)**
- `release-type`: `auto|patch|minor|major` (default `auto`)
- `changelog-path`: default `CHANGELOG.md`
- `prev-tag` / `next-tag`: manual overrides
- `preset` / `preset-path`: conventional commit mapping (built‑in preset is `presets/conventional.json`)
- `monorepo`: `true|false` (default `false`)
- `packages-glob`: default `packages/*`
- `github-token`: defaults to `GITHUB_TOKEN`

**Output**
- `next_version`: computed tag like `v1.2.3`.

**Permissions (consumer workflow)**
```yaml
permissions:
  contents: write   # required to update CHANGELOG.md and create a release
```

---

## 2) Repository layout
```
releasescribe-action/
  action.yml
  package.json           # scripts: test, build, prepare
  tsconfig.json
  presets/
    conventional.json
  src/
    index.ts             # orchestrates inputs → bump → changelog → release
    types.ts
    lib/
      commits.ts         # compareCommits, latest tag, files-per-commit (monorepo)
      preset.ts          # load preset, parse scopes, detect breaking
      bump.ts            # semver bump decision
      changelog.ts       # section building + prepend helper
      gitfile.ts         # GitHub Content API read/write
      release.ts         # GitHub Releases API
  __tests__/
    *.test.ts            # Vitest unit tests (bump/changelog/preset/monorepo)
  .gitignore
```

**Runtime & build**
- Node **20**, ESM (`"type":"module"`), bundled with **@vercel/ncc** to `dist/index.js`.
- Uses `@actions/core` and `@actions/github` (Octokit under the hood).

---

## 3) Local setup & commands

```bash
# from releasescribe-action folder
npm install
npm test           # Vitest unit tests
npm run build      # bundles dist/index.js with ncc
```

### Local harness (optional, outside the action repo)
A `test-harness/local-run.ts` can execute the compiled action against a throwaway repo:
```bash
cd ../test-harness
export TEST_REPO=your-user/your-test-repo
export GITHUB_TOKEN=ghp_xxx    # repo:write for TEST_REPO
node --loader=tsx local-run.ts
```
This will compute the bump, update/create `CHANGELOG.md`, and create a GitHub Release in TEST_REPO.

---

## 4) Quick Copilot Kickoff (paste this into Copilot Chat)

**Prompt:**
```
You are assisting on a JavaScript/TypeScript GitHub Action called "ReleaseScribe".
Goal: verify the end-to-end flow, propose improvements, and produce a PR.

Context you should use from the workspace:
- action.yml defines inputs: release-type, changelog-path, prev-tag, next-tag, preset/preset-path, monorepo, packages-glob, github-token.
- src/index.ts orchestrates: load preset → get last tag/compare → detect bump → build changelog → write via Content API → create GitHub Release → set output.
- lib/* has: commits.ts, preset.ts, bump.ts, changelog.ts, gitfile.ts, release.ts.
- presets/conventional.json defines mapping (feat → minor; fix/refactor/perf → patch; BREAKING → major; etc.).
- __tests__/* contains Vitest tests for bump/changelog/preset/monorepo basics.

Tasks:
1) Install/build/test locally (`npm install`, `npm test`, `npm run build`). Report any failures with root cause and patches.
2) Validate Octokit calls: compareCommits, createRelease; content read/write (base64 + sha). Add missing error handling if needed.
3) Edge cases: no previous tags; no new commits; BREAKING in commit body; large compare; monorepo with multi-package touches. Add/adjust unit tests.
4) Idempotency: re-run without new commits must not duplicate sections. If needed, add a guard or test.
5) DX: clarify README (Quick Start + permissions + preset example + monorepo example). Keep Action repo free of workflows.
6) Create branch `feat/dx-hardening`, apply fixes/tests/docs, run build, and prepare PR text with summary + test evidence.
Return: diff summary, updated tests list, and any follow-up suggestions (e.g., dry-run, templated release notes).
```

> Tip: After Copilot proposes changes, ask it to **open a PR** and include: summary, risk, test plan, and screenshots of local harness output if applicable.

---

## 5) Coding standards
- **Conventional Commits** for this repo (e.g., `feat:`, `fix:`, `chore:`). Use scopes when meaningful (e.g., `feat(monorepo): …`).
- Keep functions small, with explicit types. Prefer pure helpers in `lib/*` and thin orchestration in `index.ts`.
- Log concisely with `core.info`. Avoid noisy logs.
- Avoid breaking API unless major release is intended.

---

## 6) Test strategy
- Unit tests (Vitest) cover:
  - bump logic (feat → minor, fix → patch, `!` or BREAKING → major)
  - changelog grouping (Features/Fixes/Other)
  - preset overrides (`preset-path`)
  - monorepo grouping: per‑package section
  - idempotency if re-run without new commits

Run:
```bash
npm test
```

---

## 7) Monorepo mode guide
- Enable with `monorepo: true` and (optionally) `packages-glob` (default `packages/*`).
- The action maps changed files to package names by prefix (e.g., `packages/<name>/…`).
- It writes per‑package `CHANGELOG.md` and a root summary; a single release is created for the repo.

---

## 8) Common pitfalls & quick fixes
- **Node/ESM errors**: ensure Node ≥ 18/20 and `"type":"module"`. Delete `node_modules` + `package-lock.json`, then reinstall.
- **npm peer conflicts**: try `npm install --legacy-peer-deps` as a temporary workaround.
- **Content API writes failing**: make sure the workflow grants `permissions: contents: write` and that you pass `GITHUB_TOKEN`.
- **Duplicate changelog entries**: re-run guard/tests; ensure we only prepend when there are new commits since the last tag.

---

## 9) PR checklist
- [ ] `npm test` passes locally
- [ ] `npm run build` produces `dist/index.js` (do not forget to commit the bundle)
- [ ] Updated/added tests for new/changed behavior
- [ ] README updated (Quick Start, permissions, preset example, monorepo example)
- [ ] No GitHub workflows added to the Action repo (keep tests external)
- [ ] Clear PR description: summary, risk, rollout, test plan

---

## 10) Release & versioning notes
- Keep **immutable tags** for shipped versions (e.g., `v1.0.0`) and maintain the **moving major tag** `v1`.
- After merging substantive changes, cut a new tag/release (e.g., `v1.1.0`) and update the Marketplace listing if applicable.

---

## 11) Security & permissions
- Never commit secrets. Use repo/org **Secrets** in consumer workflows.
- Use **least‑privilege**: only `contents: write` is needed by consumers.
- Avoid collecting PII; the action only needs commit metadata via the GitHub API.

---

## 12) Maintainers
- PR reviews focus on correctness (Octokit calls, version math), safety (idempotency), and DX (docs/tests). Request changes if any acceptance item is missing.

---

Thanks for contributing to ReleaseScribe! 🚀
