
// @ts-ignore
import { Octokit } from "@actions/github/lib/utils";

export async function createRelease(
  octokit: InstanceType<typeof Octokit>, owner: string, repo: string,
  tag: string, name: string, body: string, target: string
): Promise<void> {
  await octokit.rest.repos.createRelease({ owner, repo, tag_name: tag, name, body, target_commitish: target });
}
