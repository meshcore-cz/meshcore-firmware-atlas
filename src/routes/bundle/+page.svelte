<script>
  // Size breakdown of the compiled JSON data bundle — top-level collections and
  // their records, ranked by byte size, as an expandable tree/table.
  import { base } from '$app/paths';
  import Seo from '$lib/Seo.svelte';
  import PageHeader from '$lib/PageHeader.svelte';
  import { formatBytes } from '$lib/bundleSize.js';
  import { fullDateTime } from '$lib/format.js';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  let { data } = $props();

  // Which sections are expanded to show their records. Starts collapsed.
  let expanded = $state(new Set());
  function toggle(key) {
    const next = new Set(expanded);
    next.has(key) ? next.delete(key) : next.add(key);
    expanded = next;
  }

  const pctLabel = (n) => `${(n * 100).toFixed(n < 0.001 ? 3 : 1)}%`;
  // Sum of section sizes is slightly under the whole-bundle size (structural
  // overhead of the outer object), so show that overhead explicitly.
  let sectionsTotal = $derived(data.sections.reduce((sum, s) => sum + s.bytes, 0));
  let overhead = $derived(data.totalBytes - sectionsTotal);

  // How much each codec shaves off the minified bundle, for the summary cards.
  const saving = (n) => `−${(100 * (1 - n / data.compressed.min)).toFixed(0)}%`;

  // Image assets — which catalogue items carry the heaviest on-disk images. Show
  // the biggest few by default; each row expands to its individual files.
  const IMG_TOP = 12;
  let imgExpanded = $state(new Set());
  function toggleImg(id) {
    const next = new Set(imgExpanded);
    next.has(id) ? next.delete(id) : next.add(id);
    imgExpanded = next;
  }
  let showAllImages = $state(false);
  let visibleImages = $derived(showAllImages ? data.images.items : data.images.items.slice(0, IMG_TOP));

  // Network area shapes (GeoJSON) — one source file per network, served separately
  // from the JSON bundle. Show the biggest few by default.
  const GEO_TOP = 12;
  let showAllGeojson = $state(false);
  let visibleGeojson = $derived(showAllGeojson ? data.geojson.items : data.geojson.items.slice(0, GEO_TOP));
  const fmtKm2 = (n) => (n == null ? '—' : `${n.toLocaleString()} km²`);

  const COLLECTION_META = {
    devices: { label: 'Device', tw: 'bg-accent/15 text-accent' },
    vendors: { label: 'Vendor', tw: 'bg-warn/15 text-warn' },
    software: { label: 'Software', tw: 'bg-ok/15 text-ok' }
  };
</script>

<Seo
  title="Data bundle size"
  description="Size breakdown of the MeshCore Ninja JSON data bundle — every collection and record ranked by byte size."
/>

<PageHeader tool="bundle" subtitleClass="mb-5 max-w-2xl">
  Where the bytes go in the compiled data bundle — each collection and its records,
  ranked by serialized size. The browsable
  <a class="text-accent2 hover:underline" href="{base}/data.json">data.json</a>
  is pretty-printed; the figures below are for the minified bundle that's actually
  shipped and compressed.
</PageHeader>

<!-- Transfer sizes: the minified bundle and its pre-built gzip / zstd siblings,
     each downloadable. -->
<div class="mb-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
  {#each [
    { label: 'Minified', bytes: data.compressed.min, href: '/data.min.json', tone: 'text-ink', note: 'data.min.json' },
    { label: 'Gzip', bytes: data.compressed.gzip, href: '/data.min.json.gz', tone: 'text-ok', note: saving(data.compressed.gzip) },
    { label: 'Zstd', bytes: data.compressed.zstd, href: '/data.min.json.zst', tone: 'text-accent', note: saving(data.compressed.zstd) }
  ] as card (card.label)}
    <a
      href="{base}{card.href}"
      class="group rounded-xl border border-edge bg-elev p-3.5 transition hover:-translate-y-0.5 hover:border-accent"
      download
    >
      <div class="flex items-baseline justify-between">
        <span class="text-[0.75rem] uppercase tracking-wide text-dim">{card.label}</span>
        <span class="font-mono text-[0.72rem] {card.tone}">{card.note}</span>
      </div>
      <div class="mt-0.5 text-2xl font-bold tabular-nums">{formatBytes(card.bytes)}</div>
      <div class="font-mono text-[0.72rem] text-dim group-hover:text-accent2">{card.bytes.toLocaleString()} bytes · download ↓</div>
    </a>
  {/each}
</div>

<div class="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2">
  <div>
    <div class="text-[0.75rem] uppercase tracking-wide text-dim">Collections</div>
    <div class="text-lg font-semibold tabular-nums">{data.sections.length}</div>
  </div>
  {#if data.generatedAt}
    <div>
      <div class="text-[0.75rem] uppercase tracking-wide text-dim">Generated</div>
      <div class="text-[0.95rem]">{fullDateTime(data.generatedAt)}</div>
    </div>
  {/if}
</div>

<div class="overflow-hidden rounded-xl border border-edge">
  <table class="w-full border-collapse text-[0.92rem]">
    <thead>
      <tr class="border-b border-edge bg-elev2 text-left text-[0.8rem] uppercase tracking-wide text-dim">
        <th class="px-4 py-2.5 font-semibold">Collection</th>
        <th class="px-4 py-2.5 text-right font-semibold">Items</th>
        <th class="hidden px-4 py-2.5 font-semibold sm:table-cell">Share</th>
        <th class="px-4 py-2.5 text-right font-semibold">Size</th>
        <th class="px-4 py-2.5 text-right font-semibold">Bytes</th>
      </tr>
    </thead>
    <tbody>
      {#each data.sections as s (s.key)}
        {@const open = expanded.has(s.key)}
        <tr
          class="group cursor-pointer border-b border-edge transition hover:bg-elev"
          onclick={() => toggle(s.key)}
        >
          <td class="px-4 py-2.5 font-medium">
            <span class="flex items-center gap-1.5">
              <ChevronRight class="h-4 w-4 shrink-0 text-dim transition-transform {open ? 'rotate-90' : ''}" aria-hidden="true" />
              <span class="font-mono">{s.key}</span>
            </span>
          </td>
          <td class="px-4 py-2.5 text-right tabular-nums text-dim">{s.count ?? '—'}</td>
          <td class="hidden px-4 py-2.5 sm:table-cell">
            <span class="flex items-center gap-2">
              <span class="h-2 flex-1 overflow-hidden rounded-full bg-elev2">
                <span class="block h-full rounded-full bg-accent" style="width:{Math.max(s.pct * 100, 0.5)}%"></span>
              </span>
              <span class="w-12 shrink-0 text-right text-[0.78rem] tabular-nums text-dim">{pctLabel(s.pct)}</span>
            </span>
          </td>
          <td class="px-4 py-2.5 text-right font-medium tabular-nums">{formatBytes(s.bytes)}</td>
          <td class="px-4 py-2.5 text-right font-mono text-[0.82rem] tabular-nums text-dim">{s.bytes.toLocaleString()}</td>
        </tr>
        {#if open}
          {#each s.children as c (c.label)}
            <tr class="border-b border-edge bg-bg/40 text-[0.86rem]">
              <td class="py-1.5 pr-4 pl-11">
                {#if c.href}
                  <a class="text-accent2 hover:underline" href="{base}{c.href}">{c.name ?? c.label}</a>
                  {#if c.name && c.label !== c.name}<span class="ml-1.5 font-mono text-[0.72rem] text-dim">{c.label}</span>{/if}
                {:else}
                  <span class="font-mono text-ink/90">{c.label}</span>
                {/if}
              </td>
              <td class="px-4 py-1.5 text-right tabular-nums text-dim">{c.count ?? '—'}</td>
              <td class="hidden px-4 py-1.5 sm:table-cell">
                <span class="flex items-center gap-2">
                  <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-elev2">
                    <span class="block h-full rounded-full bg-accent2/70" style="width:{Math.max((c.bytes / s.bytes) * 100, 0.5)}%"></span>
                  </span>
                  <span class="w-12 shrink-0 text-right text-[0.74rem] tabular-nums text-dim">{pctLabel(c.bytes / s.bytes)}</span>
                </span>
              </td>
              <td class="px-4 py-1.5 text-right tabular-nums">{formatBytes(c.bytes)}</td>
              <td class="px-4 py-1.5 text-right font-mono text-[0.8rem] tabular-nums text-dim">{c.bytes.toLocaleString()}</td>
            </tr>
          {/each}
        {/if}
      {/each}
    </tbody>
    <tfoot>
      <tr class="border-t border-edge bg-elev2/60 text-[0.84rem] text-dim">
        <td class="px-4 py-2.5" colspan="3">Metadata &amp; structural overhead (schemaVersion, counts, object braces…)</td>
        <td class="px-4 py-2.5 text-right tabular-nums">{formatBytes(overhead)}</td>
        <td class="px-4 py-2.5 text-right font-mono text-[0.82rem] tabular-nums">{overhead.toLocaleString()}</td>
      </tr>
      <tr class="border-t border-edge bg-elev2 font-semibold">
        <td class="px-4 py-3" colspan="3">Total</td>
        <td class="px-4 py-3 text-right tabular-nums">{formatBytes(data.totalBytes)}</td>
        <td class="px-4 py-3 text-right font-mono text-[0.82rem] tabular-nums">{data.totalBytes.toLocaleString()}</td>
      </tr>
    </tfoot>
  </table>
</div>

<!-- Image assets: source images stored alongside each catalogue item. These are
     hashed & served by Vite, separate from the JSON bundle above. -->
<section class="mt-9">
  <div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-edge pb-1.5">
    <div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
      <h2 class="text-[1.1rem] font-semibold">Image assets</h2>
      <span class="text-[0.78rem] text-dim">Hashed &amp; served separately — not part of the data bundle above</span>
    </div>
    <span class="text-[0.8rem] text-dim">
      {data.images.fileCount} files across {data.images.items.length} items ·
      <span class="font-medium text-ink">{formatBytes(data.images.total)}</span> total
    </span>
  </div>

  <div class="overflow-hidden rounded-xl border border-edge">
    <table class="w-full border-collapse text-[0.92rem]">
      <thead>
        <tr class="border-b border-edge bg-elev2 text-left text-[0.8rem] uppercase tracking-wide text-dim">
          <th class="px-4 py-2.5 font-semibold">Item</th>
          <th class="px-4 py-2.5 text-right font-semibold">Files</th>
          <th class="hidden px-4 py-2.5 font-semibold sm:table-cell">Share</th>
          <th class="px-4 py-2.5 text-right font-semibold">Size</th>
          <th class="px-4 py-2.5 text-right font-semibold">Bytes</th>
        </tr>
      </thead>
      <tbody>
        {#each visibleImages as it (it.collection + it.id)}
          {@const open = imgExpanded.has(it.collection + it.id)}
          <tr class="group cursor-pointer border-b border-edge transition hover:bg-elev" onclick={() => toggleImg(it.collection + it.id)}>
            <td class="px-4 py-2.5">
              <span class="flex items-center gap-1.5">
                <ChevronRight class="h-4 w-4 shrink-0 text-dim transition-transform {open ? 'rotate-90' : ''}" aria-hidden="true" />
                <span class="rounded px-1.5 py-0.5 text-[0.66rem] font-semibold uppercase {COLLECTION_META[it.collection]?.tw ?? 'bg-elev2 text-dim'}">{COLLECTION_META[it.collection]?.label ?? it.collection}</span>
                <a class="font-medium text-accent2 hover:underline" href="{base}{it.href}" onclick={(e) => e.stopPropagation()}>{it.name}</a>
              </span>
            </td>
            <td class="px-4 py-2.5 text-right tabular-nums text-dim">{it.files.length}</td>
            <td class="hidden px-4 py-2.5 sm:table-cell">
              <span class="flex items-center gap-2">
                <span class="h-2 flex-1 overflow-hidden rounded-full bg-elev2">
                  <span class="block h-full rounded-full bg-accent2" style="width:{Math.max((it.bytes / data.images.total) * 100, 0.5)}%"></span>
                </span>
                <span class="w-12 shrink-0 text-right text-[0.78rem] tabular-nums text-dim">{pctLabel(it.bytes / data.images.total)}</span>
              </span>
            </td>
            <td class="px-4 py-2.5 text-right font-medium tabular-nums">{formatBytes(it.bytes)}</td>
            <td class="px-4 py-2.5 text-right font-mono text-[0.82rem] tabular-nums text-dim">{it.bytes.toLocaleString()}</td>
          </tr>
          {#if open}
            {#each it.files as f (f.name)}
              <tr class="border-b border-edge bg-bg/40 text-[0.86rem]">
                <td class="py-1.5 pr-4 pl-11 font-mono text-ink/90">{f.name}</td>
                <td class="px-4 py-1.5"></td>
                <td class="hidden px-4 py-1.5 text-right text-[0.74rem] tabular-nums text-dim sm:table-cell">{pctLabel(f.bytes / it.bytes)}</td>
                <td class="px-4 py-1.5 text-right tabular-nums">{formatBytes(f.bytes)}</td>
                <td class="px-4 py-1.5 text-right font-mono text-[0.8rem] tabular-nums text-dim">{f.bytes.toLocaleString()}</td>
              </tr>
            {/each}
          {/if}
        {/each}
      </tbody>
    </table>
  </div>

  {#if data.images.items.length > IMG_TOP}
    <div class="mt-3 text-center">
      <button
        type="button"
        class="rounded-lg border border-edge bg-elev px-3.5 py-1.5 text-[0.85rem] text-dim transition hover:border-accent/60 hover:text-ink"
        onclick={() => (showAllImages = !showAllImages)}
      >
        {showAllImages ? `Show top ${IMG_TOP}` : `Show all ${data.images.items.length} items`}
      </button>
    </div>
  {/if}
</section>

<!-- Network area shapes: per-network area.geojson files, published to
     /network-area/ and fetched at runtime as one combined all.geojson — separate
     from the data bundle above. -->
<section class="mt-9">
  <div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-edge pb-1.5">
    <div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
      <h2 class="text-[1.1rem] font-semibold">Network area shapes</h2>
      <span class="text-[0.78rem] text-dim">GeoJSON served separately — not part of the data bundle above</span>
    </div>
    <span class="text-[0.8rem] text-dim">
      {data.geojson.count} areas ·
      <span class="font-medium text-ink">{formatBytes(data.geojson.total)}</span> source
      {#if data.geojson.combinedBytes}
        · <span class="font-medium text-ink">{formatBytes(data.geojson.combinedBytes)}</span> combined
        (<a class="text-accent2 hover:underline" href="{base}/network-area/all.geojson">all.geojson</a>, one map request)
      {/if}
    </span>
  </div>

  <div class="overflow-hidden rounded-xl border border-edge">
    <table class="w-full border-collapse text-[0.92rem]">
      <thead>
        <tr class="border-b border-edge bg-elev2 text-left text-[0.8rem] uppercase tracking-wide text-dim">
          <th class="px-4 py-2.5 font-semibold">Network</th>
          <th class="hidden px-4 py-2.5 text-right font-semibold sm:table-cell">Area</th>
          <th class="hidden px-4 py-2.5 font-semibold sm:table-cell">Share</th>
          <th class="px-4 py-2.5 text-right font-semibold">Size</th>
          <th class="px-4 py-2.5 text-right font-semibold">Bytes</th>
        </tr>
      </thead>
      <tbody>
        {#each visibleGeojson as it (it.id)}
          <tr class="border-b border-edge transition hover:bg-elev">
            <td class="px-4 py-2.5">
              <span class="flex items-center gap-2">
                <a class="font-medium text-accent2 hover:underline" href="{base}{it.href}">{it.name}</a>
                <span class="font-mono text-[0.72rem] text-dim">{it.id}</span>
              </span>
            </td>
            <td class="hidden px-4 py-2.5 text-right tabular-nums text-dim sm:table-cell">{fmtKm2(it.areaKm2)}</td>
            <td class="hidden px-4 py-2.5 sm:table-cell">
              <span class="flex items-center gap-2">
                <span class="h-2 flex-1 overflow-hidden rounded-full bg-elev2">
                  <span class="block h-full rounded-full bg-accent2" style="width:{Math.max((it.bytes / data.geojson.total) * 100, 0.5)}%"></span>
                </span>
                <span class="w-12 shrink-0 text-right text-[0.78rem] tabular-nums text-dim">{pctLabel(it.bytes / data.geojson.total)}</span>
              </span>
            </td>
            <td class="px-4 py-2.5 text-right font-medium tabular-nums">{formatBytes(it.bytes)}</td>
            <td class="px-4 py-2.5 text-right font-mono text-[0.82rem] tabular-nums text-dim">{it.bytes.toLocaleString()}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if data.geojson.items.length > GEO_TOP}
    <div class="mt-3 text-center">
      <button
        type="button"
        class="rounded-lg border border-edge bg-elev px-3.5 py-1.5 text-[0.85rem] text-dim transition hover:border-accent/60 hover:text-ink"
        onclick={() => (showAllGeojson = !showAllGeojson)}
      >
        {showAllGeojson ? `Show top ${GEO_TOP}` : `Show all ${data.geojson.items.length} areas`}
      </button>
    </div>
  {/if}
</section>
