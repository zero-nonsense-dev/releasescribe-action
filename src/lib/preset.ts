
import fs from 'node:fs';
import path from 'node:path';
import { PresetConfig, CommitLite } from "../types.js";

export function loadPreset(id?: string, presetPath?: string): PresetConfig {
  if (presetPath && fs.existsSync(presetPath)) {
    const raw = fs.readFileSync(presetPath, 'utf8');
    return JSON.parse(raw) as PresetConfig;
  }
  // built-in presets
  const builtin: Record<string, PresetConfig> = {
    conventional: JSON.parse(fs.readFileSync(path.resolve('presets/conventional.json'), 'utf8'))
  };
  return builtin[id || 'conventional'] || builtin['conventional'];
}

export function parseScopes(subject: string, headerPattern?: string): string[] | undefined {
  // default simple parser: type(scope): subject
  const re = headerPattern ? new RegExp(headerPattern) : /^(?<type>[a-zA-Z]+)(\((?<scope>[^)]+)\))?:/;
  const m = subject.match(re);
  if (!m) return undefined;
  const scope = (m.groups?.scope || '').trim();
  if (!scope) return undefined;
  return scope.split(',').map(s => s.trim()).filter(Boolean);
}

export function isBreaking(commit: CommitLite, preset: PresetConfig): boolean {
  if (commit.subject.includes('!')) return true;
  const body = commit.body || '';
  return preset.breakingIndicators?.some(ind => body.includes(ind)) || false;
}

export function categorizeType(subject: string, preset: PresetConfig): 'minor'|'patch'|'other'|undefined {
  const header = subject.split(':')[0];
  const type = header.split('(')[0].toLowerCase();
  if (preset.minorTypes.includes(type)) return 'minor';
  if (preset.patchTypes.includes(type)) return 'patch';
  if (preset.otherTypes.includes(type)) return 'other';
  return undefined;
}
