
import { describe, it, expect } from 'vitest';
import { detectBump } from '../src/lib/bump.js';
import { PresetConfig, CommitLite } from '../src/types.js';
import fs from 'node:fs';

const preset: PresetConfig = JSON.parse(fs.readFileSync('presets/conventional.json','utf8'));

describe('detectBump', () => {
  it('patch by default', () => {
    const commits: CommitLite[] = [ { sha: '1', subject: 'chore: housekeeping' } ];
    expect(detectBump(commits, preset)).toBe('patch');
  });
  it('minor when feat present', () => {
    const commits: CommitLite[] = [ { sha: '1', subject: 'feat: new feature' } ];
    expect(detectBump(commits, preset)).toBe('minor');
  });
  it('major when breaking', () => {
    const commits: CommitLite[] = [ { sha: '1', subject: 'feat!: breaking api' } ];
    expect(detectBump(commits, preset)).toBe('major');
  });
});
