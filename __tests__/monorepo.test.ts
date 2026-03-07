
import { describe, it, expect } from 'vitest';
import { buildSection } from '../src/lib/changelog.js';
import { PresetConfig, CommitLite } from '../src/types.js';
import fs from 'node:fs';

const preset: PresetConfig = JSON.parse(fs.readFileSync('presets/conventional.json','utf8'));

// This is a unit-level smoke test to ensure we can produce per-package sections
// Real package grouping is exercised at runtime via Octokit; here we only check formatting

describe('monorepo mode helpers', () => {
  it('builds per-package section', () => {
    const commits: CommitLite[] = [
      { sha: '1', subject: 'feat(pkg-a): feature A' },
      { sha: '2', subject: 'fix(pkg-a): fix A' }
    ];
    const section = buildSection('v0.1.0', commits, preset);
    expect(section).toContain('v0.1.0');
    expect(section).toMatch(/Features[\s\S]*feature A/);
    expect(section).toMatch(/Fixes[\s\S]*fix A/);
  });
});
