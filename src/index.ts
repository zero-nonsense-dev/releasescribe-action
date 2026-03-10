
import * as core from "@actions/core";
import * as github from "@actions/github";
import { getContextRef, getLatestTag, compareWithFiles, getFilesPerCommit } from "./lib/commits.js";
import { loadPreset, parseScopes } from "./lib/preset.js";
import { detectBump } from "./lib/bump.js";
import { buildSection, prependToChangelog } from "./lib/changelog.js";
import { readFile, writeFile } from "./lib/gitfile.js";
import { createRelease } from "./lib/release.js";
import { Bump, CommitLite } from "./types.js";

function unique<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

async function run() {
  try {
    const token = core.getInput('github-token') || process.env.GITHUB_TOKEN;
    if (!token) throw new Error('Missing github-token / GITHUB_TOKEN');

    const octokit = github.getOctokit(token);
    const ctx = github.context;
    const { owner, repo } = ctx.repo;
    const ref = await getContextRef(octokit, owner, repo);

    const releaseTypeInput = (core.getInput('release-type') || 'auto') as Bump | 'auto';
    const changelogPath = core.getInput('changelog-path') || 'CHANGELOG.md';
    const prevTagOverride = core.getInput('prev-tag') || undefined;
    const nextTagOverride = core.getInput('next-tag') || undefined;

    const presetId = core.getInput('preset') || 'conventional';
    const presetPath = core.getInput('preset-path') || undefined;
    const preset = loadPreset(presetId, presetPath);

    const monorepo = (core.getInput('monorepo') || 'false').toLowerCase() === 'true';
    const packagesGlob = core.getInput('packages-glob') || 'packages/*';

    // Get commits + global files changed
    const lastTag = prevTagOverride ?? await getLatestTag(octokit, owner, repo);
    const { commits, files, shas } = await compareWithFiles(octokit, ref, lastTag);

    if (commits.length === 0) { core.info('No new commits.'); return; }

    // Parse scopes for commits according to preset pattern
    for (const c of commits) { c.scopes = parseScopes(c.subject, preset.headerPattern); }

    // Decide bump (global) and compute next version
    const bump: Bump = releaseTypeInput === 'auto' ? detectBump(commits, preset) : releaseTypeInput as Bump;
    const prev = ((lastTag ?? '').replace(/^v/, '') || '0.0.0').split('.').map(n => parseInt(n,10));
    let [maj, min, pat] = (Number.isFinite(prev[0]) ? prev : [0,0,0]) as number[];
    if (nextTagOverride) {
      // use override
    } else if (bump === 'major') { maj++; min = 0; pat = 0; }
      else if (bump === 'minor') { min++; pat = 0; }
      else { pat++; }
    const nextVersion = nextTagOverride || `v${maj}.${min}.${pat}`;
    core.setOutput('next_version', nextVersion);

    if (!monorepo) {
      // Single repo mode
      const section = buildSection(nextVersion, commits, preset);
      const existing = await readFile(octokit, owner, repo, changelogPath);
      const updated = prependToChangelog(existing.content, section);
      await writeFile(octokit, owner, repo, ref.defaultBranch, changelogPath, updated, `chore(release): ${nextVersion} changelog`, existing.sha);
      await createRelease(octokit, owner, repo, nextVersion, nextVersion, section, ref.defaultBranch);
      core.info(`Released ${nextVersion}`);
      return;
    }

    // Monorepo mode – group commits by package
    // Strategy: find packages by glob prefix 'packages/<name>' and map commits by touched files per commit
    const commitFiles = await getFilesPerCommit(octokit, owner, repo, shas, 150);
    const packagePrefix = packagesGlob.split('*')[0]; // e.g., 'packages/'
    const packagesTouched: Record<string, CommitLite[]> = {};

    const pkgsFromFiles = unique(files
      .filter(f => f.startsWith(packagePrefix))
      .map(f => f.substring(packagePrefix.length).split('/')[0])
      .filter(Boolean));

    for (const pkg of pkgsFromFiles) packagesTouched[pkg] = [];

    for (const c of commits) {
      const fl = commitFiles[c.sha] || [];
      const pkgs = unique(fl
        .filter(f => f.startsWith(packagePrefix))
        .map(f => f.substring(packagePrefix.length).split('/')[0])
        .filter(Boolean));
      for (const p of pkgs) {
        (packagesTouched[p] ||= []).push(c);
      }
    } catch {}

    const updated = `# Changelog\n\n${section}\n\n${existing.replace(/^# Changelog\s*/, '')}`.trim() + '\n';

    const path = core.getInput('changelog-path');
    const branch = (await octokit.rest.repos.get({ owner, repo })).data.default_branch;

    if (dryRun) {
      core.info(`Dry run: Would update ${path} with new section:\n${section}`);
      core.info(`Dry run: Would create release ${nextVersion} with body:\n${section}`);
      core.info(`Dry run: Next version: ${nextVersion}`);
      return;
    }

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
    }

    const touchedNames = Object.keys(packagesTouched);
    if (touchedNames.length === 0) {
      core.info('Monorepo mode: no packages matched changes; falling back to root changelog.');
      const section = buildSection(nextVersion, commits, preset);
      const existing = await readFile(octokit, owner, repo, changelogPath);
      const updated = prependToChangelog(existing.content, section);
      await writeFile(octokit, owner, repo, ref.defaultBranch, changelogPath, updated, `chore(release): ${nextVersion} changelog`, existing.sha);
      await createRelease(octokit, owner, repo, nextVersion, nextVersion, section, ref.defaultBranch);
      return;
    }

    // Write per-package changelogs using the same nextVersion (global scheme)
    for (const name of touchedNames) {
      const section = buildSection(nextVersion, packagesTouched[name], preset);
      const pkgChangelogPath = `${packagePrefix}${name}/CHANGELOG.md`;
      const existing = await readFile(octokit, owner, repo, pkgChangelogPath);
      const updated = prependToChangelog(existing.content, section);
      await writeFile(octokit, owner, repo, ref.defaultBranch, pkgChangelogPath, updated, `chore(${name}): ${nextVersion} changelog`, existing.sha);
    }

    // Also update root changelog with a summary
    const summarySection = buildSection(nextVersion, commits, preset);
    const existingRoot = await readFile(octokit, owner, repo, changelogPath);
    const updatedRoot = prependToChangelog(existingRoot.content, summarySection);
    await writeFile(octokit, owner, repo, ref.defaultBranch, changelogPath, updatedRoot, `chore(release): ${nextVersion} changelog`, existingRoot.sha);

    await createRelease(octokit, owner, repo, nextVersion, nextVersion, summarySection, ref.defaultBranch);
    core.info(`Released ${nextVersion} (monorepo mode; packages: ${touchedNames.join(', ')})`);
  } catch (err: any) {
    core.setFailed(err.message || String(err));
  }
}

run();
