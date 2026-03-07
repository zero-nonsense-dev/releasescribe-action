
import { Bump, CommitLite } from "../types.js";
import { isBreaking, categorizeType } from "./preset.js";
import { PresetConfig } from "../types.js";

export function detectBump(commits: CommitLite[], preset: PresetConfig): Bump {
  if (commits.some(c => isBreaking(c, preset))) return 'major';
  if (commits.some(c => categorizeType(c.subject, preset) === 'minor')) return 'minor';
  return 'patch';
}
