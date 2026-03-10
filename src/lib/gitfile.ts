
import { Octokit } from "@actions/github/lib/utils";

export async function readFile(octokit: InstanceType<typeof Octokit>, owner: string, repo: string, path: string): Promise<{content?: string, sha?: string}> {
  try {
    const file = await octokit.rest.repos.getContent({ owner, repo, path });
    if ('content' in file.data) {
      return {
        content: Buffer.from((file.data as any).content, 'base64').toString('utf8'),
        sha: (file.data as any).sha
      };
    }
    return {};
  } catch { return {}; }
}

export async function writeFile(
  octokit: InstanceType<typeof Octokit>, owner: string, repo: string, branch: string,
  path: string, content: string, message: string, sha?: string
): Promise<void> {
  await octokit.rest.repos.createOrUpdateFileContents({
    owner, repo, path, branch, sha,
    message,
    content: Buffer.from(content, 'utf8').toString('base64')
  });
}
