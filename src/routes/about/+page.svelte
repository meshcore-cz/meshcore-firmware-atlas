<script>
  import { base } from '$app/paths';
  import { REPO_URL } from '$lib/seo.js';
  import Seo from '$lib/Seo.svelte';
  import PageHeader from '$lib/PageHeader.svelte';
</script>

<Seo
  title="About"
  description="How MeshCore Ninja works — a community-maintained, open-data catalog of MeshCore networks, devices and firmwares, generated from human-readable YAML."
/>

<PageHeader tool="about" />
<p class="max-w-[70ch]">
  <strong>MeshCore Ninja</strong> is a community-maintained catalogue for the
  <a class="text-accent2 hover:underline" href="https://meshcore.io" target="_blank" rel="noreferrer">MeshCore</a>
  ecosystem — the regional and national
  <a class="text-accent2 hover:underline" href="{base}/networks/">networks</a> people run, the
  <a class="text-accent2 hover:underline" href="{base}/devices/">devices</a> that join them, and the
  <a class="text-accent2 hover:underline" href="{base}/firmwares/">firmwares</a> that run on them
  (the official build plus community forks and custom variants). Each entry carries detailed specs,
  and a <a class="text-accent2 hover:underline" href="{base}/matrix/">compatibility matrix</a>
  shows which firmware supports which hardware at a glance.
</p>

<h2 class="mt-7 text-[1.15rem] font-semibold">How it works</h2>
<p class="max-w-[70ch]">
  The catalogue is generated at build time from human-readable YAML files in the
  <code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.9em]">data/</code> folder — no database, no server. Records live in
  collections — <code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.9em]">networks</code>, <code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.9em]">devices</code>, <code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.9em]">firmwares</code> and
  <code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.9em]">vendors</code> — each a directory of records, where the directory name
  <em>is</em> the id. A build step compiles them into a single
  <a class="text-accent2 hover:underline" href="{base}/data.json">data.json</a> the app reads (and which is published for
  reuse).
</p>
<p class="mt-3 max-w-[70ch]">
  The one exception is <strong>live network activity</strong> — recent packets, active nodes and
  observers shown on some network views. That data isn't static: it's gathered and served by an
  optional realtime collector with its own backing store, and the site only shows it when that
  service is configured. Everything else works as a plain static site with no backend.
</p>

<h2 class="mt-7 text-[1.15rem] font-semibold">Contributing</h2>
<ol class="max-w-[70ch] list-decimal pl-5">
  <li class="mb-1.5">Add or edit a record in the relevant collection, e.g.
    <code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.9em]">data/networks/&lt;id&gt;/network.yaml</code> or
    <code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.9em]">data/devices/&lt;id&gt;/device.yaml</code>.</li>
  <li class="mb-1.5">Cross-link records by id — a device's <code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.9em]">vendorId</code>, a firmware's
    <code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.9em]">devices:</code> list, a network's radio bands, and so on.</li>
  <li class="mb-1.5">Run <code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.9em]">npm test</code> to validate against the JSON Schema and referential checks.</li>
  <li class="mb-1.5">Open a PR.</li>
</ol>
<p class="max-w-[70ch]">See <code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.9em]">data/RULES.md</code> for the authoring guide and <code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.9em]">data/SCHEMA.md</code> for the full field reference.</p>

<div class="mt-4 flex flex-wrap gap-2.5">
  <a
    href={REPO_URL}
    target="_blank"
    rel="noreferrer"
    class="inline-flex items-center gap-2 rounded-lg border border-edge bg-elev px-3.5 py-2 text-[0.9rem] font-medium text-ink transition hover:border-accent hover:text-accent"
  >
    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.78 1.2 1.78 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.67 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17a10.9 10.9 0 0 1 5.74 0c2.18-1.48 3.14-1.17 3.14-1.17.63 1.58.24 2.75.12 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.37-5.25 5.66.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
    <span>View the source on GitHub</span>
  </a>
  <a
    href="{REPO_URL}/issues"
    target="_blank"
    rel="noreferrer"
    class="inline-flex items-center rounded-lg border border-edge bg-elev px-3.5 py-2 text-[0.9rem] font-medium text-ink transition hover:border-accent hover:text-accent"
  >
    Report an issue
  </a>
</div>

<h2 class="mt-7 text-[1.15rem] font-semibold">Accuracy</h2>
<p class="max-w-[70ch]">
  Details are gathered from each project's repository and may lag behind the
  latest release. Corrections via PR are very welcome.
</p>

<h2 class="mt-7 text-[1.15rem] font-semibold">Licensing</h2>
<p class="max-w-[70ch]">
  The MeshCore Ninja database — device, firmware, network and compatibility
  records, schemas, and the generated exports (<a class="text-accent2 hover:underline" href="{base}/data.json">data.json</a>,
  <a class="text-accent2 hover:underline" href="{base}/devices.json">/devices.json</a> and friends) — is dedicated to the public domain under
  <a class="text-accent2 hover:underline" href="{REPO_URL}/blob/main/data/LICENSE" target="_blank" rel="noreferrer">CC0 1.0 Universal</a>,
  so anyone can embed, sync or re-publish it without attribution. The application
  source code is licensed under the
  <a class="text-accent2 hover:underline" href="{REPO_URL}/blob/main/LICENSE" target="_blank" rel="noreferrer">MIT License</a>.
</p>
<p class="mt-3 max-w-[70ch]">
  Third-party device photographs, vendor logos and trademarks remain the property
  of their respective owners and are not covered by the CC0 dedication. See the
  <a class="text-accent2 hover:underline" href="{REPO_URL}/blob/main/LICENSES.md" target="_blank" rel="noreferrer">full licensing breakdown</a>
  for details.
</p>
