<script>
  // Shared 3D-prints catalogue: search box, type-filter links and the card grid.
  // `activeType` comes from the route (/prints/ or /prints/<type>/) so each
  // filtered view is its own prerendered page. The free-text query stays
  // client-side, mirrored to `?q=`. Mirrors FirmwareList.svelte.
  import { href } from '$lib/i18n.js';
  import { m } from '$lib/paraglide/messages.js';
  import { printType, deviceMcuLabel, deviceRadioLabel, printTypeLabel, printTypeSingular } from '$lib/data.js';
  import { pluralize } from '$lib/format.js';
  import PageHeader from '$lib/PageHeader.svelte';
  import Box from '@lucide/svelte/icons/box';
  import Heart from '@lucide/svelte/icons/heart';
  import CircuitBoard from '@lucide/svelte/icons/circuit-board';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  let { prints, types = [], activeType = 'all' } = $props();

  let query = $state('');
  let hydrated = $state(false);

  onMount(() => {
    query = new URLSearchParams(location.search).get('q') ?? '';
    hydrated = true;
  });

  $effect(() => {
    if (!browser || !hydrated) return;
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    const qs = p.toString();
    history.replaceState(history.state, '', qs ? `${location.pathname}?${qs}` : location.pathname);
  });

  // Friendly label for the host a printable is published on.
  const PRINT_HOSTS = {
    'printables.com': 'Printables', 'thingiverse.com': 'Thingiverse', 'makerworld.com': 'MakerWorld',
    'github.com': 'GitHub', 'heltec.org': 'Heltec', 'lilygo.cc': 'LilyGo', 'docs.rakwireless.com': 'RAKwireless'
  };
  function printHost(url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return PRINT_HOSTS[host] ?? host;
    } catch {
      return 'Link';
    }
  }

  // "2026-03-13" → "Mar 2026"; "2026-03" → "Mar 2026". Falls back to the raw value.
  function dateLabel(date) {
    if (!date) return null;
    const [y, m] = String(date).split('-');
    const month = Number(m);
    if (!y || !month) return String(date);
    return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month - 1]} ${y}`;
  }

  const chipBase = 'rounded-full border px-3 py-1.5 text-[0.85rem] transition select-none';
  const chipOn = 'border-accent bg-accent/15 text-accent';
  const chipOff = 'border-edge bg-elev text-dim hover:border-accent/60 hover:text-ink';
  const typeHref = (t) => (t === 'all' ? href('/prints/') : href(`/prints/${t}/`));

  // Solid, high-contrast badge over the (busy) cover photo — one colour per type.
  const TYPE_BADGE = {
    enclosure: 'bg-accent text-bg',
    case: 'bg-accent2 text-bg',
    accessory: 'bg-ok text-bg'
  };

  // Compact "basic info" line for the device footer, e.g. "nRF52840 · SX1262".
  function deviceInfo(device) {
    return [deviceMcuLabel(device), deviceRadioLabel(device)]
      .filter((s) => s && s !== 'Unknown')
      .join(' · ');
  }

  let filtered = $derived(
    prints.filter((p) => {
      if (activeType !== 'all' && printType(p) !== activeType) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.author ?? '').toLowerCase().includes(q) ||
        (p.device?.name ?? '').toLowerCase().includes(q)
      );
    })
  );

  // Client-side pagination, 100 per page. Reset to page 1 when the filter set
  // changes (new query or type).
  const PER_PAGE = 100;
  let page = $state(1);
  $effect(() => {
    query;
    activeType;
    page = 1;
  });
  let pageCount = $derived(Math.max(1, Math.ceil(filtered.length / PER_PAGE)));
  let pageItems = $derived(filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE));
</script>

<PageHeader tool="prints" subtitleClass="max-w-[60ch]">
  {m.print_list_subtitle()}
</PageHeader>

<div class="mb-4 flex flex-wrap items-center gap-4">
  <input
    type="search"
    placeholder={m.print_list_search()}
    bind:value={query}
    class="min-w-[220px] flex-1 rounded-lg border border-edge bg-bg px-3 py-2.5 text-[0.95rem] outline-none focus:border-transparent focus:ring-2 focus:ring-accent"
  />
  <!-- Type filter — links so each view is its own prerendered route. -->
  <div class="flex flex-wrap gap-1.5">
    <a href={typeHref('all')} class="{chipBase} {activeType === 'all' ? chipOn : chipOff}">{m.filter_all()}</a>
    {#each types as t (t)}
      <a href={typeHref(t)} class="{chipBase} {activeType === t ? chipOn : chipOff}">
        {printTypeLabel(t)}
      </a>
    {/each}
  </div>
</div>

<p class="mb-4 text-[0.85rem] text-dim">{pluralize(filtered.length, 'print')}</p>

<div class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
  {#each pageItems as p (p.device.id + p.url)}
    {@const type = printType(p)}
    <!-- Card holds two separate links: the cover/title open the model, the footer
         opens the device — so they can't be a single nested <a>. -->
    <div class="group flex flex-col overflow-hidden rounded-xl border border-edge bg-elev transition hover:-translate-y-0.5 hover:border-accent">
      <a class="flex flex-1 flex-col" href={p.url} target="_blank" rel="noreferrer">
        <div class="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-elev2 text-muted">
          {#if p.image}
            <img src={p.image} alt={p.name} loading="lazy" class="h-full w-full object-cover transition group-hover:scale-105" />
          {:else}
            <Box class="h-12 w-12" aria-hidden="true" />
          {/if}
          <span class="absolute top-1.5 left-1.5 rounded-md px-2 py-0.5 text-[0.66rem] font-semibold tracking-wide uppercase shadow-sm {TYPE_BADGE[type] ?? 'bg-elev2 text-dim'}">
            {printTypeSingular(type)}
          </span>
          {#if p.likes != null}
            <span class="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[0.7rem] font-medium text-white backdrop-blur-sm" title="{p.likes.toLocaleString()} likes on {printHost(p.url)}">
              <Heart class="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span class="tabular-nums">{p.likes.toLocaleString()}</span>
            </span>
          {/if}
        </div>
        <div class="flex flex-1 flex-col gap-0.5 p-3">
          <span class="text-[0.9rem] leading-tight font-medium group-hover:text-accent" title={p.name}>{p.name}</span>
          {#if p.author}<span class="text-[0.78rem] text-dim">{m.print_by({ author: p.author })}</span>{/if}
          <span class="mt-1.5 flex flex-wrap items-center gap-x-2 text-[0.72rem] text-dim">
            <span class="text-accent2">{printHost(p.url)} ↗</span>
            {#if dateLabel(p.date)}<span>· {dateLabel(p.date)}</span>{/if}
          </span>
        </div>
      </a>
      <!-- Device footer — which board this print is for, linking to its profile. -->
      <a
        href={href(`/device/${p.device.id}/`)}
        class="flex items-center gap-2.5 border-t border-edge px-3 py-2 transition hover:bg-elev2"
        title="View {p.device.name}"
      >
        <div class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-elev2">
          {#if p.device.imageUrl}
            <img src={p.device.imageUrl} alt={p.device.name} loading="lazy" class="h-full w-full object-contain" />
          {:else}
            <CircuitBoard class="h-5 w-5 text-muted" aria-hidden="true" />
          {/if}
        </div>
        <div class="flex min-w-0 flex-col">
          <span class="truncate text-[0.82rem] font-medium text-accent2">{p.device.name}</span>
          {#if deviceInfo(p.device)}<span class="truncate text-[0.7rem] text-dim">{deviceInfo(p.device)}</span>{/if}
        </div>
        <ChevronRight class="ml-auto h-4 w-4 shrink-0 text-dim" aria-hidden="true" />
      </a>
    </div>
  {/each}
</div>

{#if pageCount > 1}
  <div class="mt-6 flex items-center justify-center gap-3">
    <button
      type="button"
      class="rounded-lg border border-edge bg-elev px-3 py-1.5 text-[0.85rem] text-dim transition hover:border-accent/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      disabled={page === 1}
      onclick={() => (page = Math.max(1, page - 1))}
    >
      ← {m.pagination_prev()}
    </button>
    <span class="text-[0.85rem] text-dim tabular-nums">{m.print_page_of({ page, total: pageCount })}</span>
    <button
      type="button"
      class="rounded-lg border border-edge bg-elev px-3 py-1.5 text-[0.85rem] text-dim transition hover:border-accent/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      disabled={page === pageCount}
      onclick={() => (page = Math.min(pageCount, page + 1))}
    >
      {m.pagination_next()} →
    </button>
  </div>
{/if}
