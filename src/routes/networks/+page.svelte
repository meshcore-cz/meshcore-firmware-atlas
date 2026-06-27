<script>
  import { href } from '$lib/i18n.js';
  import { m } from '$lib/paraglide/messages.js';
  import {
    NETWORK_SCOPE_META,
    networkScopeLabel,
    networkFlags,
    networkRadioSettings,
    networkBands,
    bandLabel,
    isAppPresetNetwork
  } from '$lib/data.js';
  import NetworkAreaMap from '$lib/NetworkAreaMap.svelte';
  import AppPresetBadge from '$lib/AppPresetBadge.svelte';
  import Seo from '$lib/Seo.svelte';
  import PageHeader from '$lib/PageHeader.svelte';
  import ToolLink from '$lib/ToolLink.svelte';
  import Button from '$lib/Button.svelte';
  import { Toggle } from 'bits-ui';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { LIVE_ENABLED, poll, fmtRate } from '$lib/pulse.js';
  let { data } = $props();

  // Live pkt/m per network, polled from the optional API. Keyed by network id;
  // empty (and the column hidden) when no API is configured.
  let liveById = $state({});
  onMount(() =>
    poll('/api/networks', 5000, (res) => {
      const next = {};
      for (const n of res.networks ?? []) next[n.id] = n;
      liveById = next;
    })
  );

  // One frequency label per radio, e.g. "869.618 MHz" (falls back to a band key).
  const radioFreq = (r) =>
    r?.frequency_mhz != null
      ? `${r.frequency_mhz} MHz`
      : r?.frequency
        ? (bandLabel(r.frequency) ?? r.frequency)
        : '—';

  // Per-column sort value accessors. Strings sort case-insensitively; nullish
  // (or empty) values always sink to the bottom regardless of direction.
  const SORT_ACCESSORS = {
    name: (n) => n.name?.toLowerCase() ?? '',
    scope: (n) => NETWORK_SCOPE_META[n.scope]?.label ?? n.scope ?? '',
    area: (n) => n.areaKm2,
    frequency: (n) => networkRadioSettings(n)[0]?.frequency_mhz ?? null,
    sf: (n) => networkRadioSettings(n)[0]?.spreading_factor ?? null,
    bw: (n) => networkRadioSettings(n)[0]?.bandwidth_khz ?? null,
    cr: (n) => networkRadioSettings(n)[0]?.coding_rate ?? '',
    live: (n) => liveById[n.id]?.pktPerMin ?? null,
    nodes: (n) => liveById[n.id]?.nodes ?? null,
    observers: (n) => liveById[n.id]?.observers ?? null
  };

  // Default to largest coverage area first, matching the page's prior ordering.
  let sortKey = $state('area');
  let sortDir = $state('desc');

  function toggleSort(key) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      // Text columns read best A→Z; numeric columns biggest-first.
      sortDir = typeof SORT_ACCESSORS[key](data.networks[0]) === 'string' ? 'asc' : 'desc';
    }
  }

  // Deprecated networks are kept for reference but pulled out of the map and the
  // main table into their own section below.
  let activeNetworks = $derived(data.networks.filter((n) => !n.deprecated));
  let deprecatedNetworks = $derived(data.networks.filter((n) => n.deprecated));

  // --- Filters --------------------------------------------------------------
  // Narrow the table (and, via `visibleIds`, the map) by free-text name, scope
  // and frequency band. Scopes/bands are multi-select: empty means "any".
  // State is synced to / from the URL (see the $effect below), so a filtered view
  // is shareable and bookmarkable — matching the Devices page. It starts at its
  // defaults so the first client render matches the prerendered (unfiltered) HTML;
  // the URL is read in onMount, after hydration. Reading it at init instead
  // diverged from the prerendered table and corrupted hydration.
  let query = $state('');
  let selectedScopes = $state(new Set());
  let selectedBands = $state(new Set());
  let hydrated = $state(false);

  onMount(() => {
    const p = new URLSearchParams(location.search);
    const csv = (key) => (p.get(key) ?? '').split(',').filter(Boolean);
    query = p.get('q') ?? '';
    selectedScopes = new Set(csv('scope'));
    selectedBands = new Set(csv('band'));
    hydrated = true;
  });

  // Toggling reassigns a fresh Set so Svelte's reactivity picks up the change.
  function toggleIn(set, value) {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    return next;
  }
  const toggleScope = (s) => (selectedScopes = toggleIn(selectedScopes, s));
  const toggleBand = (b) => (selectedBands = toggleIn(selectedBands, b));
  function clearFilters() {
    query = '';
    selectedScopes = new Set();
    selectedBands = new Set();
  }
  let hasFilters = $derived(
    query.trim() !== '' || selectedScopes.size > 0 || selectedBands.size > 0
  );

  // Only offer scopes/bands that actually occur, in a stable order.
  let scopeOptions = $derived(
    Object.keys(NETWORK_SCOPE_META).filter((s) => activeNetworks.some((n) => n.scope === s))
  );
  let bandOptions = $derived.by(() => {
    const set = new Set();
    for (const n of activeNetworks) for (const b of networkBands(n)) set.add(b);
    return [...set].sort((a, b) => Number(a) - Number(b));
  });

  let filteredNetworks = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return activeNetworks.filter((n) => {
      if (q) {
        const hay = `${n.name ?? ''} ${n.short_name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (selectedScopes.size && !selectedScopes.has(n.scope)) return false;
      if (selectedBands.size && !networkBands(n).some((b) => selectedBands.has(b))) return false;
      return true;
    });
  });

  // The set of ids the map should keep visible (drives layer show/hide there).
  let visibleIds = $derived(new Set(filteredNetworks.map((n) => n.id)));

  // Reflect the active filters into the query string so a filtered view is
  // shareable. Native history.replaceState keeps it a pure URL-bar update — no
  // navigation, no scroll, no history entries, and no dependence on the router.
  $effect(() => {
    // Wait until onMount has applied the URL → state, or the first run would
    // immediately overwrite the incoming query string with empty defaults.
    if (!browser || !hydrated) return;
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    if (selectedScopes.size) p.set('scope', [...selectedScopes].join(','));
    if (selectedBands.size) p.set('band', [...selectedBands].join(','));
    const qs = p.toString();
    history.replaceState(history.state, '', qs ? `${location.pathname}?${qs}` : location.pathname);
  });

  let sortedNetworks = $derived.by(() => {
    const get = SORT_ACCESSORS[sortKey];
    const dir = sortDir === 'asc' ? 1 : -1;
    const empty = (v) => v == null || v === '';
    return [...filteredNetworks].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (empty(va) && empty(vb)) return 0;
      if (empty(va)) return 1;
      if (empty(vb)) return -1;
      if (typeof va === 'string') return dir * va.localeCompare(vb);
      return dir * (va - vb);
    });
  });
</script>

<Seo
  title={m.collection_networks_label()}
  description={m.networks_seo_desc({ count: data.networks.length })}
/>

<PageHeader collection="networks">
  {#snippet actions()}
    <ToolLink id="bands" />
  {/snippet}
  {m.networks_intro()}
</PageHeader>

{#if data.networks.length}
  <NetworkAreaMap networks={activeNetworks} {visibleIds} {liveById} />

  <div class="mb-4 flex flex-col gap-3 rounded-xl border border-edge bg-elev p-3 sm:flex-row sm:flex-wrap sm:items-center">
    <div class="relative sm:w-60">
      <svg class="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" stroke-linecap="round" />
      </svg>
      <input
        type="search"
        bind:value={query}
        placeholder={m.networks_filter_placeholder()}
        aria-label={m.networks_filter_aria()}
        class="w-full rounded-md border border-edge bg-bg py-1.5 pr-3 pl-8 text-[0.85rem] text-ink placeholder:text-dim focus:border-accent focus:outline-none"
      />
    </div>

    {#if scopeOptions.length}
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="mr-0.5 text-[0.72rem] tracking-wide text-dim uppercase">{m.networks_scope()}</span>
        {#each scopeOptions as scope (scope)}
          <Toggle.Root
            pressed={selectedScopes.has(scope)}
            onPressedChange={() => toggleScope(scope)}
            class="rounded-md border px-2 py-0.5 text-[0.72rem] font-medium outline-none transition {selectedScopes.has(scope) ? 'border-accent bg-accent/15 text-accent' : 'border-edge text-dim hover:text-ink'}"
          >{networkScopeLabel(scope)}</Toggle.Root>
        {/each}
      </div>
    {/if}

    {#if bandOptions.length}
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="mr-0.5 text-[0.72rem] tracking-wide text-dim uppercase">{m.dev_facet_band()}</span>
        {#each bandOptions as band (band)}
          <Toggle.Root
            pressed={selectedBands.has(band)}
            onPressedChange={() => toggleBand(band)}
            class="rounded-md border px-2 py-0.5 text-[0.72rem] font-medium outline-none transition {selectedBands.has(band) ? 'border-accent2 bg-accent2/15 text-accent2' : 'border-edge text-dim hover:text-ink'}"
          >{bandLabel(band) ?? band}</Toggle.Root>
        {/each}
      </div>
    {/if}

    <div class="flex items-center gap-2 sm:ml-auto">
      <span class="text-[0.78rem] text-dim tabular-nums">
        {m.networks_count({ shown: filteredNetworks.length, total: activeNetworks.length })}
      </span>
      {#if hasFilters}
        <Button
          variant=""
          size="none"
          onclick={clearFilters}
          class="rounded-md border border-edge px-2 py-0.5 text-[0.72rem] text-dim hover:text-ink"
        >{m.compare_bar_clear()}</Button>
      {/if}
    </div>
  </div>

  {#snippet sortTh(key, label, alignRight = false, title = null)}
    <th
      class="border-b border-edge px-3.5 py-2.5 {alignRight ? 'text-right' : ''}"
      aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Button
        variant=""
        size="none"
        class="gap-1 tracking-wide uppercase hover:text-ink {alignRight ? 'flex-row-reverse' : ''} {sortKey === key ? 'text-ink' : ''}"
        onclick={() => toggleSort(key)}
        {title}
      >
        <span>{label}</span>
        <span class="text-[0.7em] {sortKey === key ? 'text-accent' : 'opacity-30'}" aria-hidden="true">
          {sortKey === key && sortDir === 'asc' ? '▲' : '▼'}
        </span>
      </Button>
    </th>
  {/snippet}

  {#snippet networkRow(n)}
    {@const radios = networkRadioSettings(n)}
    {@const rows = Math.max(radios.length, 1)}
    {@const live = liveById[n.id]}
    <tbody class="group hover:bg-elev">
    {#each radios.length ? radios : [null] as r, i}
      {@const last = i === rows - 1}
      {@const bc = last ? 'border-b border-edge' : 'border-b border-edge/30'}
      <tr>
        {#if i === 0}
          <td rowspan={rows} class="border-b border-edge px-3.5 py-2.5 align-middle">
            <a class="flex items-center gap-2.5 font-medium group-hover:text-accent" href={href(`/network/${n.id}/`)}>
              {#each networkFlags(n) as flag (flag.code)}
                <span
                  class="inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-edge/70 [&>svg]:h-full [&>svg]:w-full [&>svg]:object-cover"
                  title={flag.code}
                  aria-hidden="true"
                >
                  {@html flag.svg}
                </span>
              {/each}
              <span>{n.name}</span>
              {#if n.short_name && n.short_name !== n.name}
                <span class="font-mono text-[0.74rem] text-dim">{n.short_name}</span>
              {/if}
              {#if isAppPresetNetwork(n)}
                <AppPresetBadge />
              {/if}
            </a>
          </td>
          <td rowspan={rows} class="border-b border-edge px-3.5 py-2.5 align-middle">
            {#if n.scope}
              <span class="rounded-md px-2 py-0.5 text-[0.68rem] font-bold tracking-wide uppercase {NETWORK_SCOPE_META[n.scope]?.tw ?? 'bg-elev2 text-dim'}">
                {networkScopeLabel(n.scope)}
              </span>
            {/if}
          </td>
        {/if}
        <td class="{bc} px-3.5 py-2 font-mono text-[0.8rem] tabular-nums whitespace-nowrap">{radioFreq(r)}</td>
        <td class="{bc} px-3.5 py-2 font-mono text-[0.8rem] tabular-nums text-dim">{r?.spreading_factor != null ? `SF${r.spreading_factor}` : '—'}</td>
        <td class="{bc} px-3.5 py-2 font-mono text-[0.8rem] tabular-nums whitespace-nowrap text-dim">{r?.bandwidth_khz != null ? `${r.bandwidth_khz} kHz` : '—'}</td>
        <td class="{bc} px-3.5 py-2 font-mono text-[0.8rem] tabular-nums text-dim">{r?.coding_rate ?? '—'}</td>
        {#if LIVE_ENABLED && i === 0}
          <td rowspan={rows} class="border-b border-edge px-3.5 py-2.5 text-right align-middle font-mono text-[0.82rem] tabular-nums whitespace-nowrap">
            {#if live}
              <span
                class={live.analyzersConnected ? 'text-accent' : 'text-dim'}
                title={m.networks_analyzers_title({ connected: live.analyzersConnected, total: live.analyzersTotal })}
              >{fmtRate(live.pktPerMin)}</span>
            {:else}
              <span class="text-dim">—</span>
            {/if}
          </td>
          <td rowspan={rows} class="border-b border-edge px-3.5 py-2.5 text-right align-middle font-mono text-[0.82rem] tabular-nums whitespace-nowrap">
            {#if live}{live.nodes.toLocaleString()}{:else}<span class="text-dim">—</span>{/if}
          </td>
          <td rowspan={rows} class="border-b border-edge px-3.5 py-2.5 text-right align-middle font-mono text-[0.82rem] tabular-nums whitespace-nowrap">
            {#if live}{live.observers.toLocaleString()}{:else}<span class="text-dim">—</span>{/if}
          </td>
        {/if}
      </tr>
    {/each}
    </tbody>
  {/snippet}

  <div class="overflow-x-auto rounded-xl border border-edge">
    <table class="w-full border-collapse text-[0.9rem]">
      <thead>
        <tr class="text-left text-[0.78rem] tracking-wide text-dim uppercase">
          {@render sortTh('name', m.cmd_type_network())}
          {@render sortTh('scope', m.networks_scope())}
          {@render sortTh('frequency', m.networks_col_frequency())}
          {@render sortTh('sf', 'SF')}
          {@render sortTh('bw', 'BW')}
          {@render sortTh('cr', 'CR')}
          {#if LIVE_ENABLED}
            {@render sortTh('live', 'pkt/m', true, m.networks_live_pktm_title())}
            {@render sortTh('nodes', m.networks_col_nodes(), true, m.networks_live_nodes_title())}
            {@render sortTh('observers', m.networks_col_observers(), true, m.networks_live_observers_title())}
          {/if}
        </tr>
      </thead>
        {#each sortedNetworks as n (n.id)}{@render networkRow(n)}{/each}
    </table>
    {#if !sortedNetworks.length}
      <p class="px-3.5 py-6 text-center text-[0.85rem] text-dim">
        {m.networks_no_match()}
        <Button variant="" size="none" onclick={clearFilters} class="text-accent hover:underline">{m.networks_clear_filters()}</Button>
      </p>
    {/if}
  </div>

  {#if deprecatedNetworks.length}
    <h2 class="mt-9 mb-1 text-[1.1rem] font-semibold">{m.networks_deprecated_title()}</h2>
    <p class="mb-3 max-w-[70ch] text-[0.85rem] text-dim">
      {m.networks_deprecated_body()}
    </p>
    <div class="overflow-x-auto rounded-xl border border-edge opacity-80">
      <table class="w-full border-collapse text-[0.9rem]">
        <thead>
          <tr class="text-left text-[0.78rem] tracking-wide text-dim uppercase">
            <th class="border-b border-edge px-3.5 py-2.5">{m.cmd_type_network()}</th>
            <th class="border-b border-edge px-3.5 py-2.5">{m.networks_scope()}</th>
            <th class="border-b border-edge px-3.5 py-2.5">{m.networks_col_frequency()}</th>
            <th class="border-b border-edge px-3.5 py-2.5">SF</th>
            <th class="border-b border-edge px-3.5 py-2.5">BW</th>
            <th class="border-b border-edge px-3.5 py-2.5">CR</th>
            {#if LIVE_ENABLED}
              <th class="border-b border-edge px-3.5 py-2.5 text-right">pkt/m</th>
              <th class="border-b border-edge px-3.5 py-2.5 text-right">{m.networks_col_nodes()}</th>
              <th class="border-b border-edge px-3.5 py-2.5 text-right">{m.networks_col_observers()}</th>
            {/if}
          </tr>
        </thead>
        {#each deprecatedNetworks as n (n.id)}{@render networkRow(n)}{/each}
      </table>
    </div>
  {/if}
{:else}
  <p class="text-dim">{m.networks_empty()}</p>
{/if}
