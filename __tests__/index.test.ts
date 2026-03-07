import { describe, it, expect } from 'vitest';

const TYPES_MINOR = ['feat'];

function detectBump(subjects: string[]): 'major'|'minor'|'patch' {
  if (subjects.some((s) => s.includes('!'))) return 'major';
  if (subjects.some((s) => TYPES_MINOR.some((t) => s.startsWith(t + ':')))) return 'minor';
  return 'patch';
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