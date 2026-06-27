<script>
  import { base } from '$app/paths';
  import { href } from '$lib/i18n.js';
  import { m } from '$lib/paraglide/messages.js';
  import { REPO_URL } from '$lib/seo.js';
  import Seo from '$lib/Seo.svelte';
  import PageHeader from '$lib/PageHeader.svelte';

  // Inline link / code-span builders for prose messages rendered with {@html}.
  // Message text is authored by us (trusted); only our own markup is injected.
  const a = (url, label, ext = false) =>
    `<a class="text-accent2 hover:underline" href="${url}"${ext ? ' target="_blank" rel="noreferrer"' : ''}>${label}</a>`;
  const code = (t) => `<code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.9em]">${t}</code>`;

  let intro = $derived({
    meshcore: a('https://meshcore.io', 'MeshCore', true),
    networks: a(href('/networks/'), m.collection_networks_label().toLowerCase()),
    devices: a(href('/devices/'), m.collection_devices_label().toLowerCase()),
    firmwares: a(href('/firmwares/'), m.collection_firmwares_label().toLowerCase()),
    matrix: a(href('/matrix/'), m.tool_matrix_label().toLowerCase())
  });
  let howP1 = $derived({
    dataDir: code('data/'),
    networks: code('networks'),
    devices: code('devices'),
    firmwares: code('firmwares'),
    vendors: code('vendors'),
    datajson: a(`${base}/data.json`, 'data.json')
  });
  const step1 = { networkYaml: code('data/networks/&lt;id&gt;/network.yaml'), deviceYaml: code('data/devices/&lt;id&gt;/device.yaml') };
  const step2 = { vendorId: code('vendorId'), devicesList: code('devices:') };
  const step3 = { npmTest: code('npm test') };
  const guide = { rules: code('data/RULES.md'), schema: code('data/SCHEMA.md') };
  let licensingP1 = $derived({
    datajson: a(`${base}/data.json`, 'data.json'),
    devicesjson: a(`${base}/devices.json`, '/devices.json'),
    cc0: a(`${REPO_URL}/blob/main/data/LICENSE`, 'CC0 1.0 Universal', true),
    mit: a(`${REPO_URL}/blob/main/LICENSE`, 'MIT License', true)
  });
  const licensingP2 = { breakdown: a(`${REPO_URL}/blob/main/LICENSES.md`, 'full licensing breakdown', true) };
</script>

<Seo title={m.about_seo_title()} description={m.about_seo_desc()} />

<PageHeader tool="about" />
<p class="max-w-[70ch]">{@html m.about_intro(intro)}</p>

<h2 class="mt-7 text-[1.15rem] font-semibold">{m.about_how_title()}</h2>
<p class="max-w-[70ch]">{@html m.about_how_p1(howP1)}</p>
<p class="mt-3 max-w-[70ch]">{@html m.about_how_p2()}</p>

<h2 class="mt-7 text-[1.15rem] font-semibold">{m.about_contributing_title()}</h2>
<ol class="max-w-[70ch] list-decimal pl-5">
  <li class="mb-1.5">{@html m.about_step_1(step1)}</li>
  <li class="mb-1.5">{@html m.about_step_2(step2)}</li>
  <li class="mb-1.5">{@html m.about_step_3(step3)}</li>
  <li class="mb-1.5">{m.about_step_4()}</li>
</ol>
<p class="max-w-[70ch]">{@html m.about_guide(guide)}</p>

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
    <span>{m.about_source_btn()}</span>
  </a>
  <a
    href="{REPO_URL}/issues"
    target="_blank"
    rel="noreferrer"
    class="inline-flex items-center rounded-lg border border-edge bg-elev px-3.5 py-2 text-[0.9rem] font-medium text-ink transition hover:border-accent hover:text-accent"
  >
    {m.about_report_btn()}
  </a>
</div>

<h2 class="mt-7 text-[1.15rem] font-semibold">{m.about_accuracy_title()}</h2>
<p class="max-w-[70ch]">{m.about_accuracy_p()}</p>

<h2 class="mt-7 text-[1.15rem] font-semibold">{m.about_licensing_title()}</h2>
<p class="max-w-[70ch]">{@html m.about_licensing_p1(licensingP1)}</p>
<p class="mt-3 max-w-[70ch]">{@html m.about_licensing_p2(licensingP2)}</p>
