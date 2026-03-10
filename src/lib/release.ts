
import { OctokitClient } from "../types.js";

export async function createRelease(
  octokit: OctokitClient, owner: string, repo: string,
  tag: string, name: string, body: string, target: string
): Promise<void> {
  await octokit.rest.repos.createRelease({ owner, repo, tag_name: tag, name, body, target_commitish: target });
}
