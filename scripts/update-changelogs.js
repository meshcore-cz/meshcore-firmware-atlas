// Fetches release info for each firmware and writes data/firmwares/<id>/changelog.yaml.
//
// Source resolution per firmware (firmware.yaml):
//   changelog.source: github | manual | script
//     - github (default when `repository` is a GitHub URL): releases pulled from
//       the GitHub API and the file is overwritten.
//     - manual: the file is hand-maintained; this script leaves it untouched.
//     - script: GitHub releases are fetched (for tags/dates/links) and then
//       passed to a per-firmware enrichment script that lives in the firmware's
//       data folder (changelog.script, default "fetch-changelog.js"). The script
//       default-exports `async ({ githubReleases, mapRelease, fetch }) => releases`.
//   changelog.repo: "owner/name" override (else parsed from `repository`).
//
// Usage: node scripts/update-changelogs.js
// Honors GITHUB_TOKEN (raises the API rate limit in CI).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_RELEASES = 20;
const MAX_NOTE_CHARS = 4000;

function parseRepo(fw) {
  if (fw.changelog?.repo) return fw.changelog.repo;
  const m = /github\.com\/([^/]+\/[^/#?]+)/.exec(fw.repository ?? '');
  return m ? m[1].replace(/\.git$/, '') : null;
}

function resolveSource(fw) {
  if (fw.changelog?.source) return fw.changelog.source;
  return parseRepo(fw) ? 'github' : null;
}

/** Fetch raw (unmapped) GitHub releases, drafts removed. */
async function fetchGithubRaw(repo) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'meshcore-index',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=${MAX_RELEASES}`, {
    headers
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${repo}`);
  const data = await res.json();
  return data.filter((r) => !r.draft).slice(0, MAX_RELEASES);
}

/** Map one raw GitHub release to the stored changelog shape. */
function mapRelease(r) {
  const out = {
    version: r.tag_name,
    name: r.name || r.tag_name,
    datetime: r.published_at ?? r.created_at ?? undefined,
    url: r.html_url,
    prerelease: !!r.prerelease
  };
  const notes = (r.body ?? '').trim();
  if (notes) out.notes = notes.length > MAX_NOTE_CHARS ? notes.slice(0, MAX_NOTE_CHARS) + '\n…' : notes;
  return out;
}

async function buildReleases(fw, dir, source) {
  const repo = parseRepo(fw);

  if (source === 'github') {
    if (!repo) throw new Error('github source but no repo could be resolved');
    return { repo, releases: (await fetchGithubRaw(repo)).map(mapRelease) };
  }

  if (source === 'script') {
    const scriptName = fw.changelog?.script ?? 'fetch-changelog.js';
    const scriptPath = join(root, 'data', 'firmwares', dir, scriptName);
    if (!existsSync(scriptPath)) throw new Error(`missing changelog script ${scriptName}`);
    const githubReleases = repo ? await fetchGithubRaw(repo) : [];
    const mod = await import(pathToFileURL(scriptPath).href);
    const releases = await mod.default({ githubReleases, mapRelease, fetch, repo });
    return { repo, releases };
  }

  throw new Error(`unknown source "${source}"`);
}

const fwBase = join(root, 'data', 'firmwares');
let updated = 0;
let failed = 0;

for (const d of readdirSync(fwBase, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const fwPath = join(fwBase, d.name, 'firmware.yaml');
  if (!existsSync(fwPath)) continue;
  const fw = yaml.load(readFileSync(fwPath, 'utf8')) ?? {};

  const source = resolveSource(fw);
  if (source === 'manual') {
    console.log(`· ${d.name}: manual changelog, skipping`);
    continue;
  }
  if (!source) {
    console.log(`· ${d.name}: no release source, skipping`);
    continue;
  }

  try {
    const { repo, releases } = await buildReleases(fw, d.name, source);
    const out = { source, repo: repo ?? undefined, updatedAt: new Date().toISOString(), releases };
    writeFileSync(
      join(fwBase, d.name, 'changelog.yaml'),
      yaml.dump(out, { lineWidth: 100, noRefs: true })
    );
    console.log(`✓ ${d.name}: ${releases.length} release(s) via ${source}${repo ? ` (${repo})` : ''}`);
    updated++;
  } catch (err) {
    console.error(`✗ ${d.name}: ${err.message}`);
    failed++;
  }
}

console.log(`\nDone — ${updated} updated, ${failed} failed.`);
if (failed > 0 && updated === 0) process.exit(1);
