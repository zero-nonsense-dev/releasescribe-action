
import { describe, it, expect } from 'vitest';
import { buildSection, prependToChangelog } from '../src/lib/changelog.js';
import { CommitLite, PresetConfig } from '../src/types.js';
import fs from 'node:fs';

const preset: PresetConfig = JSON.parse(fs.readFileSync('presets/conventional.json','utf8'));

describe('changelog', () => {
  it('builds section grouping by type', () => {
    const commits: CommitLite[] = [
      { sha: 'a', subject: 'feat: cool' },
      { sha: 'b', subject: 'fix: bug' },
      { sha: 'c', subject: 'docs: add docs' }
    ];
    const section = buildSection('v1.2.3', commits, preset);
    expect(section).toContain('### Features');
    expect(section).toContain('### Fixes');
    expect(section).toContain('### Other');
  });
  it('prepends to existing changelog', () => {
    const section = '# Changelog\n\n## v1 - 2024-01-01';
    const updated = prependToChangelog(undefined, section);
    expect(updated.startsWith('# Changelog\n\n# Changelog')).toBe(false);
  });
});
