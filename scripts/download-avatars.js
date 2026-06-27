// Mirrors GitHub contributor avatars into static/contributors/ so the homepage
// serves them from our own origin instead of hot-linking avatars.githubusercontent.com.
//
// Reads the avatar URLs already in data/contributors.json (no GitHub API call),
// downloads each at a retina-friendly size, writes the local path back onto each
// contributor as `avatar`, and prunes files for contributors that have left.
//
// Runs automatically at the end of `npm run enrich:contributors`, or on its own:
//   npm run enrich:avatars
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT_BY_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

/**
 * Download every contributor avatar into static/contributors/ and rewrite
 * data/contributors.json with local `avatar` paths.
 * @param {string} root Repo root.
 * @param {{ size?: number }} [opts] `size` is the GitHub `s=` pixel size (retina ~144).
 */
export async function downloadAvatars(root, { size = 144 } = {}) {
  const jsonPath = join(root, 'data', 'contributors.json');
  const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const contributors = data.contributors ?? [];

  const outDir = join(root, 'static', 'contributors');
  mkdirSync(outDir, { recursive: true });

  /** @type {Set<string>} */
  const written = new Set();

  for (const c of contributors) {
    if (!c.avatarUrl) continue;
    const url = `${c.avatarUrl}${c.avatarUrl.includes('?') ? '&' : '?'}s=${size}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`  ! ${c.login}: HTTP ${res.status}, keeping remote avatar`);
        continue;
      }
      const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      const ext = EXT_BY_TYPE[type] ?? 'png';
      const file = `${c.login}.${ext}`;
      writeFileSync(join(outDir, file), Buffer.from(await res.arrayBuffer()));
      c.avatar = `contributors/${file}`;
      written.add(file);
      console.log(`  ✓ ${c.login} → static/${c.avatar}`);
    } catch (err) {
      console.warn(`  ! ${c.login}: ${err.message}, keeping remote avatar`);
    }
  }

  // Drop avatars for contributors no longer in the list.
  for (const file of readdirSync(outDir)) {
    if (file === '.gitkeep' || written.has(file)) continue;
    rmSync(join(outDir, file));
    console.log(`  – pruned static/contributors/${file}`);
  }

  writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`);
  return { count: written.size };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  downloadAvatars(root)
    .then(({ count }) => console.log(`✓ mirrored ${count} avatar(s)`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
