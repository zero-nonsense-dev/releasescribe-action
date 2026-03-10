
import { CommitLite, ContextRef, OctokitClient } from "../types.js";

export async function getContextRef(octokit: OctokitClient, owner: string, repo: string): Promise<ContextRef> {
  const r = await octokit.rest.repos.get({ owner, repo });
  return { owner, repo, defaultBranch: r.data.default_branch! };
}

export async function getLatestTag(octokit: OctokitClient, owner: string, repo: string): Promise<string | undefined> {
  const tags = await octokit.rest.repos.listTags({ owner, repo, per_page: 1 });
  return tags.data[0]?.name;
}

export async function compareWithFiles(
  octokit: OctokitClient,
  ref: ContextRef,
  base: string | undefined,
  head = 'HEAD'
): Promise<{ commits: CommitLite[]; files: string[]; shas: string[] }> {
  const _base = base || ref.defaultBranch;
  const cmp = await octokit.rest.repos.compareCommits({ owner: ref.owner, repo: ref.repo, base: _base, head });
  const commits: CommitLite[] = cmp.data.commits.map(c => ({
    sha: c.sha,
    subject: c.commit.message.split('\n')[0],
    body: c.commit.message.split('\n').slice(1).join('\n')
  }));
  const files = (cmp.data.files || []).map(f => f.filename);
  const shas = commits.map(c => c.sha);
  return { commits, files, shas };
}

export async function getFilesPerCommit(
  octokit: OctokitClient,
  owner: string,
  repo: string,
  shas: string[],
  cap = 150
): Promise<Record<string,string[]>> {
  const map: Record<string,string[]> = {};
  const limited = shas.slice(0, cap);
  for (const sha of limited) {
    const c = await octokit.rest.repos.getCommit({ owner, repo, ref: sha });
    map[sha] = (c.data.files || []).map(f => f.filename);
  }
  return map;
}
