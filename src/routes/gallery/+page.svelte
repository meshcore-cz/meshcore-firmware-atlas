<script>
  // Device Gallery — a purely decorative, full-bleed grid of every device
  // thumbnail. Clicking a tile opens a lightbox with a much larger image and a
  // few key specs; a link there leads to the full device profile.
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { Dialog } from 'bits-ui';
  import Seo from '$lib/Seo.svelte';
  import PageHeader from '$lib/PageHeader.svelte';
  import { pluralize } from '$lib/format.js';
  import X from '@lucide/svelte/icons/x';
  let { data } = $props();

  let byId = $derived(new Map(data.devices.map((d) => [d.id, d])));
  // The open device lives in the URL (?device=<id>) so every tile is a real,
  // shareable link and a direct link opens straight into the lightbox.
  let selectedId = $derived(browser ? ($page.url.searchParams.get('device') ?? null) : null);
  let selected = $derived(selectedId ? (byId.get(selectedId) ?? null) : null);
  let open = $derived(!!selected);

  function openDevice(id) {
    goto(`${base}/gallery/?device=${id}`, { keepFocus: true, noScroll: true });
  }
  function closeDialog() {
    goto(`${base}/gallery/`, { keepFocus: true, noScroll: true });
  }

  // A couple of compact spec lines for the lightbox, skipping unknowns.
  let specs = $derived(
    selected
      ? [
          ['Vendor', selected.vendorName],
          ['MCU', selected.mcu !== 'Unknown' ? selected.mcu : null],
          ['Radio', selected.radio !== 'Unknown' ? selected.radio : null],
          ['Bands', selected.bands.length ? selected.bands.join(', ') : null],
          ['Price', selected.price]
        ].filter(([, v]) => v)
      : []
  );
</script>

<Seo
  title="Device Gallery"
  description="A wall of every MeshCore device — a purely visual grid of hardware thumbnails."
/>

<PageHeader tool="gallery" subtitleClass="max-w-2xl">
  Just the hardware — a wall of every catalogued MeshCore
  <a class="text-accent2 hover:underline" href="{base}/devices/">device</a>. {pluralize(data.devices.length, 'board')},
  no specs in sight (until you click one). Every thumbnail is a vector SVG, so it stays crisp at any size.
</PageHeader>

<!-- Break out of the layout's centred max-width container to span the viewport. -->
<div class="mx-[calc(50%-50vw)] w-screen px-[clamp(0.5rem,2vw,1.25rem)]">
  <div class="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(130px,1fr))] sm:gap-3 sm:[grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
    {#each data.devices as d (d.id)}
      <a
        href="{base}/gallery/?device={d.id}"
        onclick={(e) => {
          e.preventDefault();
          openDevice(d.id);
        }}
        class="group relative block aspect-square cursor-zoom-in overflow-hidden rounded-xl border border-edge bg-elev2 transition hover:z-10 hover:-translate-y-1 hover:border-accent hover:shadow-xl hover:shadow-black/30"
        title={d.name}
      >
        <img
          src={d.imageUrl}
          alt={d.name}
          loading="lazy"
          class="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-110"
        />
        <span
          class="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/85 to-transparent px-2.5 pt-6 pb-2 text-[0.78rem] leading-tight font-medium text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100"
        >
          {d.name}
        </span>
      </a>
    {/each}
  </div>
</div>

<Dialog.Root {open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-[860px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-edge bg-elev shadow-2xl outline-none"
    >
      {#if selected}
        <!-- Big image on top so it can fill most of the dialog. -->
        <div class="flex items-center justify-center bg-elev2 p-8 sm:p-12">
          <img src={selected.imageUrl} alt={selected.name} class="max-h-[64vh] w-auto max-w-full object-contain" />
        </div>
        <!-- Info below -->
        <div class="flex flex-col gap-3 overflow-y-auto p-5 sm:p-7">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <Dialog.Title class="text-[1.35rem] leading-tight font-bold">{selected.name}</Dialog.Title>
              {#if selected.vendorName}
                <div class="mt-0.5 text-[0.85rem] text-dim">{selected.vendorName}</div>
              {/if}
            </div>
            <a
              href="{base}/device/{selected.id}/"
              class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent px-3.5 py-2 text-[0.88rem] font-medium text-bg transition hover:opacity-90"
            >
              View full profile →
            </a>
          </div>

          <dl class="flex flex-wrap gap-x-6 gap-y-2 text-[0.9rem]">
            {#each specs as [label, value]}
              <div class="flex flex-col">
                <dt class="text-[0.7rem] uppercase tracking-wide text-dim">{label}</dt>
                <dd>{value}</dd>
              </div>
            {/each}
          </dl>

          {#if selected.roles.length}
            <div class="flex flex-wrap gap-1.5">
              {#each selected.roles as role}
                <span class="rounded bg-elev2 px-2 py-0.5 text-[0.72rem] text-dim">{role}</span>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
      <Dialog.Close
        class="absolute top-3 right-3 rounded-lg border border-edge bg-bg/70 p-1.5 text-dim backdrop-blur-sm transition hover:text-ink"
        aria-label="Close"
      >
        <X class="h-4 w-4" />
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
