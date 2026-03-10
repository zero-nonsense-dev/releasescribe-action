
import { describe, it, expect } from 'vitest';
import { loadPreset, parseScopes } from '../src/lib/preset.js';

describe('preset', () => {
  it('loads builtin conventional', () => {
    const p = loadPreset('conventional');
    expect(p.minorTypes).toContain('feat');
  });
  it('parses scope', () => {
    const scopes = parseScopes('feat(pkg-a): new api');
    expect(scopes).toEqual(['pkg-a']);
  });
});
