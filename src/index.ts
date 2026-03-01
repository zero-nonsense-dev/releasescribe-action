
import * as core from '@actions/core';
import * as github from '@actions/github';

const TYPES_MINOR = ['feat'];

function detectBump(subjects: string[]): 'major'|'minor'|'patch' {
  if (subjects.some((s) => s.includes('!'))) return 'major';
  if (subjects.some((s) => TYPES_MINOR.some((t) => s.startsWith(t + ':')))) return 'minor';
  return 'patch';
}

function buildChangelog(version: string, commits: {sha:string;msg:string}[]) {
  const sections: Record<string,string[]> = { Features: [], Fixes: [], Other: [] };
  for (const c of commits) {
    const msg = c.msg;
    if (msg.startsWith('feat')) sections.Features.push(`- ${msg} (${c.sha.slice(0,7)})`);
    else if (msg.startsWith('fix')) sections.Fixes.push(`- ${msg} (${c.sha.slice(0,7)})`);
    else sections.Other.push(`- ${msg} (${c.sha.slice(0,7)})`);
  }
  return [
    `## ${version} - ${new Date().toISOString().split('T')[0]}`,
    sections.Features.length ? `### Features
${sections.Features.join('
')}` : '',
    sections.Fixes.length ? `### Fixes
${sections.Fixes.join('
')}` : '',
    sections.Other.length ? `### Other
${sections.Other.join('
')}` : ''
  ].filter(Boolean).join('

');
}

async function run() {
  try {
    const token = core.getInput('github-token') || (process.env.GITHUB_TOKEN as string);
    const octokit = github.getOctokit(token);
    const ctx = github.context;

    const owner = ctx.repo.owner;
    const repo = ctx.repo.repo;

    const tags = await octokit.rest.repos.listTags({ owner, repo, per_page: 1 });
    const prevTag = core.getInput('prev-tag') || (tags.data[0]?.name ?? '');
    const nextTagInput = core.getInput('next-tag');

    const base = prevTag || (await octokit.rest.repos.get({ owner, repo })).data.default_branch;
    const head = 'HEAD';
    const compare = await octokit.rest.repos.compareCommits({ owner, repo, base, head });

    const commits = compare.data.commits.map((c) => ({ sha: c.sha, msg: c.commit.message.split('
')[0] }));

    let bump = core.getInput('release-type') as 'auto'|'patch'|'minor'|'major';
    if (bump === 'auto') bump = detectBump(commits.map((c) => c.msg));

    const prev = (prevTag?.replace(/^v/, '') || '0.0.0').split('.').map((n) => parseInt(n,10));
    let [maj, min, pat] = prev as number[];
    if (bump === 'major') { maj++; min = 0; pat = 0; }
    else if (bump === 'minor') { min++; pat = 0; }
    else { pat++; }
    const nextVersion = nextTagInput || `v${maj}.${min}.${pat}`;
    core.setOutput('next_version', nextVersion);

    const section = buildChangelog(nextVersion, commits);

    // Read existing changelog if present
    let existing = '';
    let existingSha: string | undefined = undefined;
    try {
      const file = await octokit.rest.repos.getContent({ owner, repo, path: core.getInput('changelog-path') });
      if ('content' in file.data) {
        // @ts-ignore
        existing = Buffer.from(file.data.content, 'base64').toString('utf8');
        // @ts-ignore
        existingSha = file.data.sha as string;
      }
    } catch {}

    const updated = `# Changelog

${section}

${existing.replace(/^# Changelog\s*/, '')}`.trim() + '
';

    const path = core.getInput('changelog-path');
    const branch = (await octokit.rest.repos.get({ owner, repo })).data.default_branch;

    await octokit.rest.repos.createOrUpdateFileContents({
      owner, repo, path,
      message: `chore(release): ${nextVersion} changelog`,
      content: Buffer.from(updated,'utf8').toString('base64'),
      sha: existingSha,
      branch
    });

    await octokit.rest.repos.createRelease({
      owner, repo,
      tag_name: nextVersion,
      name: nextVersion,
      body: section,
      target_commitish: branch
    });

    core.info(`Released ${nextVersion}`);
  } catch (err: any) {
    core.setFailed(err.message);
  }
}

run();
