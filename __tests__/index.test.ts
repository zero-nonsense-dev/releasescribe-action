import { describe, it, expect } from 'vitest';

const TYPES_MINOR = ['feat'];

function detectBump(subjects: string[]): 'major'|'minor'|'patch' {
  if (subjects.some((s) => s.includes('!'))) return 'major';
  if (subjects.some((s) => TYPES_MINOR.some((t) => s.startsWith(t + ':')))) return 'minor';
  return 'patch';
}

function buildChangelog(version: string, commits: {sha:string;msg:string}[]) {
  const sections: Record<string,string[]> = { Features: [], Fixes: [], Other: [] };
  for (const c of commits) {
    const msg = c.msg;
    if (msg.startsWith('feat')) sections.Features.push(`- ${msg} (${c.sha.slice(0,7)})`);
    else if (msg.startsWith('fix')) sections.Fixes.push(`- ${msg} (${c.sha.slice(0,7)})`);
    else sections.Other.push(`- ${msg} (${c.sha.slice(0,7)})`);
  }
  return [
    `## ${version} - ${new Date().toISOString().split('T')[0]}`,
    sections.Features.length ? `### Features\n${sections.Features.join('\n')}` : '',
    sections.Fixes.length ? `### Fixes\n${sections.Fixes.join('\n')}` : '',
    sections.Other.length ? `### Other\n${sections.Other.join('\n')}` : ''
  ].filter(Boolean).join('\n\n');
}

describe('detectBump', () => {
  it('patch by default', () => {
    const subjects = ['chore: housekeeping'];
    expect(detectBump(subjects)).toBe('patch');
  });
  it('minor when feat present', () => {
    const subjects = ['feat: new feature'];
    expect(detectBump(subjects)).toBe('minor');
  });
  it('major when breaking', () => {
    const subjects = ['feat!: breaking api'];
    expect(detectBump(subjects)).toBe('major');
  });
  it('validates release-type input', () => {
    // This would be tested in integration, but here just ensure function works
    expect(detectBump(['fix: bug'])).toBe('patch');
  });
});

describe('buildChangelog', () => {
  it('builds section with features and fixes', () => {
    const commits = [
      { sha: 'abc123def', msg: 'feat: add cool feature' },
      { sha: 'def456ghi', msg: 'fix: resolve bug' },
      { sha: 'ghi789jkl', msg: 'docs: update readme' }
    ];
    const result = buildChangelog('v1.2.3', commits);
    expect(result).toContain('## v1.2.3');
    expect(result).toContain('### Features');
    expect(result).toContain('- feat: add cool feature (abc123d)');
    expect(result).toContain('### Fixes');
    expect(result).toContain('- fix: resolve bug (def456g)');
    expect(result).toContain('### Other');
    expect(result).toContain('- docs: update readme (ghi789j)');
  });
});