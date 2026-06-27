import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildData } from './scripts/build-data.js';
import { buildParaglideUrlPatterns } from './scripts/route-slugs.js';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

// Absolute deploy base path (e.g. "" for a root site, "/meshcore-ninja" for a
// GitHub-Pages project site). Paraglide's URL strategy must know about it so it
// can locate the locale segment after the base path.
const BASE_PATH = (process.env.BASE_PATH ?? '').replace(/\/+$/, '');
const paraglideUrlPatterns = buildParaglideUrlPatterns(BASE_PATH, projectRoot);

// Recompile data.json whenever a YAML file under data/ changes. Rewriting
// src/lib/generated/data.json makes Vite hot-reload the modules that import it.
function yamlDataPlugin() {
  const dataDir = join(projectRoot, 'data');
  const isYaml = (f) => f.startsWith(dataDir) && /\.ya?ml$/.test(f);
  const isDeviceAsset = (f) => f.startsWith(join(dataDir, 'devices')) && /\.(svg|pdf)$/.test(f);
  return {
    name: 'meshcore-yaml-data',
    configureServer(server) {
      server.watcher.add(dataDir);
      const regen = async (file) => {
        if (!isYaml(file) && !isDeviceAsset(file)) return;
        try {
          const c = await buildData(projectRoot);
          server.config.logger.info(
            `\x1b[32m[data]\x1b[0m rebuilt data.json - ${c.firmwares} firmwares, ${c.devices} devices`
          );
        } catch (err) {
          server.config.logger.error(`[data] failed to rebuild: ${err.message}`);
        }
      };
      server.watcher.on('change', regen);
      server.watcher.on('add', regen);
      server.watcher.on('unlink', regen);
    }
  };
}

export default defineConfig({
  plugins: [
    yamlDataPlugin(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      strategy: ['url', 'baseLocale'],
      urlPatterns: paraglideUrlPatterns
    }),
    tailwindcss(),
    sveltekit()
  ],
  // Expose the deploy base path to app code for building absolute (canonical /
  // OG / JSON-LD) URLs. SvelteKit's $app/paths `base` is relative in this static
  // build, so it can't be used for that; this mirrors what build-data.js reads.
  define: {
    'import.meta.env.VITE_BASE_PATH': JSON.stringify(
      (process.env.BASE_PATH ?? '').replace(/\/+$/, '')
    ),
    'import.meta.env.VITE_SITE_ORIGIN': JSON.stringify(
      (process.env.VITE_SITE_ORIGIN ?? process.env.SITE_ORIGIN ?? 'https://meshcore.ninja').replace(
        /\/+$/,
        ''
      )
    ),
    'import.meta.env.VITE_VERSION_SUFFIX': JSON.stringify(process.env.VITE_VERSION_SUFFIX ?? '')
  },
  server: {
    // Allow the dev server to serve device images that live under data/.
    fs: { allow: [projectRoot] }
  }
});
