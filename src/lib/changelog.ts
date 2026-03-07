
import { CommitLite } from "../types.js";
import { categorizeType } from "./preset.js";
import { PresetConfig } from "../types.js";

export interface ChangelogSection { version: string; dateISO: string; features: string[]; fixes: string[]; others: string[] }

export function buildSection(version: string, commits: CommitLite[], preset: PresetConfig): string {
  const d = new Date().toISOString().slice(0,10);
  const section: ChangelogSection = { version, dateISO: d, features: [], fixes: [], others: [] };

  for (const c of commits) {
    const kind = categorizeType(c.subject, preset);
    const line = `- ${c.subject} (${c.sha.slice(0,7)})`;
    if (kind === 'minor') section.features.push(line);
    else if (kind === 'patch') section.fixes.push(line);
    else section.others.push(line);
  }

  const parts = [
    `## ${section.version} - ${section.dateISO}`,
    section.features.length ? `### Features\n${section.features.join('\n')}` : '',
    section.fixes.length ? `### Fixes\n${section.fixes.join('\n')}` : '',
    section.others.length ? `### Other\n${section.others.join('\n')}` : ''
  ].filter(Boolean);

  return parts.join('\n\n');
}

export function prependToChangelog(existing: string | undefined, newSection: string): string {
  const trimmed = (existing || '').replace(/^\s+|\s+$/g, '');
  if (!trimmed) return `# Changelog\n\n${newSection}\n`;
  const withoutTitle = trimmed.replace(/^#\s*Changelog\s*\n?/i, '');
  return `# Changelog\n\n${newSection}\n\n${withoutTitle}\n`;
}
