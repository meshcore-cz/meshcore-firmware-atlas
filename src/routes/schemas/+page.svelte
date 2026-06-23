<script>
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { REPO_URL } from '$lib/seo.js';
  import Seo from '$lib/Seo.svelte';
  import PageHeader from '$lib/PageHeader.svelte';
  import Chip from '$lib/Chip.svelte';
  import SchemaNode from '$lib/SchemaNode.svelte';

  let { data } = $props();
  const schemas = data.schemas;

  // Selected schema, deep-linkable via the URL hash (e.g. /schemas/#network).
  // The hash only exists client-side; this page is prerendered, so default to
  // the first schema until the browser tells us otherwise.
  let selectedId = $state(schemas[0]?.id ?? null);
  $effect(() => {
    if (!browser) return;
    const fromHash = $page.url.hash.replace(/^#/, '');
    if (fromHash && schemas.some((s) => s.id === fromHash)) selectedId = fromHash;
  });

  let selected = $derived(schemas.find((s) => s.id === selectedId) ?? schemas[0]);

  // Expand/collapse all: `treeKey` remounts the tree so each node re-reads
  // `defaultOpen`. Bumped on toggle and on schema change (reset to collapsed).
  let allOpen = $state(false);
  let treeKey = $state(0);
  function setAll(open) {
    allOpen = open;
    treeKey += 1;
  }

  function pick(id) {
    selectedId = id;
    setAll(false);
    if (browser) history.replaceState(history.state, '', `#${id}`);
  }

  let showRaw = $state(false);

  // Top-level properties of the selected schema, with their required flags.
  let topProps = $derived(Object.entries(selected?.schema?.properties ?? {}));
  let requiredSet = $derived(new Set(selected?.schema?.required ?? []));
</script>

<Seo
  title="Schema explorer"
  description="Browse the full MeshCore Ninja data schemas — every property, type, constraint, description and example for networks, devices, firmwares, software and more."
/>

<PageHeader tool="schemas" subtitleClass="max-w-[72ch]">
  Every record in the catalog is validated against a JSON Schema. Browse the full shape of each
  collection below — properties, types, constraints, descriptions and examples. The schemas are the
  source of truth for the YAML in
  <a class="text-accent2 hover:underline" href="{base}/data.json">data.json</a>.
</PageHeader>

<div class="mb-6 flex flex-wrap gap-2">
  {#each schemas as s}
    <Chip pressed={s.id === selected?.id} onPressedChange={() => pick(s.id)}>
      {s.title}
    </Chip>
  {/each}
</div>

{#if selected}
  <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 class="text-[1.3rem] font-bold">{selected.title}</h2>
      {#if selected.description}
        <p class="mt-1 max-w-[72ch] text-dim">{selected.description}</p>
      {/if}
    </div>
    <div class="flex shrink-0 gap-2">
      <button
        class="rounded-lg border border-edge bg-elev px-3 py-1.5 text-[0.85rem] text-dim transition hover:border-accent hover:text-ink"
        onclick={() => (showRaw = !showRaw)}
      >
        {showRaw ? 'Hide JSON' : 'View JSON'}
      </button>
      <a
        class="rounded-lg border border-edge bg-elev px-3 py-1.5 text-[0.85rem] text-dim transition hover:border-accent hover:text-ink"
        href="{REPO_URL}/blob/main/{selected.file}"
        target="_blank"
        rel="noreferrer"
      >
        Source
      </a>
    </div>
  </div>

  {#if showRaw}
    <pre class="mb-6 overflow-x-auto rounded-xl border border-edge bg-elev p-4 text-[0.8rem] leading-relaxed"><code>{JSON.stringify(selected.schema, null, 2)}</code></pre>
  {/if}

  <div class="mb-3 flex items-center gap-3 text-[0.8rem]">
    <button class="text-dim transition hover:text-accent" onclick={() => setAll(true)}>Expand all</button>
    <span class="text-edge">·</span>
    <button class="text-dim transition hover:text-accent" onclick={() => setAll(false)}>Collapse all</button>
  </div>

  <section class="flex flex-col gap-4 rounded-xl border border-edge bg-elev p-5">
    {#key treeKey}
      {#if topProps.length}
        {#each topProps as [key, child]}
          <SchemaNode name={key} schema={child} root={selected.schema} required={requiredSet.has(key)} defaultOpen={allOpen} />
        {/each}
      {:else}
        <SchemaNode schema={selected.schema} root={selected.schema} defaultOpen={allOpen} />
      {/if}
    {/key}
  </section>
{/if}
