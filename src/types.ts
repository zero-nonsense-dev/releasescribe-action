
export type Bump = 'major' | 'minor' | 'patch';
export interface CommitLite { sha: string; subject: string; body?: string; scopes?: string[] }
export interface ContextRef { owner: string; repo: string; defaultBranch: string }
export interface PresetConfig {
  breakingIndicators: string[];
  minorTypes: string[];
  patchTypes: string[];
  otherTypes: string[];
  scopesIgnored?: string[];
  headerPattern?: string;
}

export type OctokitClient = ReturnType<typeof import("@actions/github").getOctokit>;
