<script>
  import { href } from '$lib/i18n.js';
  import { m } from '$lib/paraglide/messages.js';
  import {
    deviceMcuLabel,
    deviceSearchText,
    deviceDisplayLabel,
    devicePriceLabel,
    resolveMcuInfo,
    resolveRadio,
    bandLabel,
    nodeRoleLabel,
    deviceLifecycleLabel
  } from '$lib/data.js';
  import { compareIds, toggleCompare, clearCompare } from '$lib/compare.js';
  import { favoriteIds, toggleFavorite } from '$lib/favorites.js';
  import { pluralize } from '$lib/format.js';
  import Select from '$lib/Select.svelte';
  import Chip from '$lib/Chip.svelte';
  import Button from '$lib/Button.svelte';
  import PageHeader from '$lib/PageHeader.svelte';
  import ToolLink from '$lib/ToolLink.svelte';
  import CollectionLink from '$lib/CollectionLink.svelte';
  import Card from '$lib/Card.svelte';
  import CompareBar from '$lib/CompareBar.svelte';
  import { Collapsible } from 'bits-ui';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  // `activeCategory` comes from the route (/devices/ or /devices/<category>/) so
  // each category view is its own prerendered, indexable page.
  let { devices, activeCategory = 'all' } = $props();

  // Use-class category — the routed primary filter. Order = tab order.
  const CATEGORY_ORDER = ['development-board', 'companion-radio', 'standalone', 'repeater', 'tracker', 'other'];
  const CATEGORY_LABELS = {
    'development-board': m.dev_cat_development_board(),
    'companion-radio': m.dev_cat_companion_radio(),
    standalone: m.dev_cat_standalone(),
    repeater: m.dev_cat_repeater(),
    tracker: m.dev_cat_tracker(),
    other: m.dev_cat_other()
  };

  // --- Per-device accessors used by both facets and card rendering -----------
  const deviceFamily = (d) => resolveMcuInfo(d)?.family?.name ?? deviceMcuLabel(d);
  const radioShort = (d) => {
    const chip = (d.hardware?.radios ?? []).map((r) => r.chip).find((c) => c && c !== 'unknown');
    return chip ? (resolveRadio(chip)?.name ?? chip) : null;
  };
  const deviceChips = (d) =>
    (d.hardware?.radios ?? []).map((r) => r.chip).filter((c) => c && c !== 'unknown');

  // Capability pills shown on each card, in priority order. Only present
  // capabilities render, so cards stay clean for sparsely-documented boards.
  function featurePills(d) {
    const out = [];
    const pw = d.hardware?.power;
    if (d.hardware?.gnss?.status === 'present') out.push({ label: 'GPS' });
    if (d.hardware?.display?.status === 'present')
      out.push({ label: deviceDisplayLabel(d.hardware.display) });
    if (pw?.batteryCapacityMah) out.push({ label: `${pw.batteryCapacityMah} mAh`, accent: true });
    // Only a built-in solar panel is a notable feature — solar *input* (the
    // ability to attach a panel) is an option, not shown here.
    if (pw?.solarPanelBuiltIn) out.push({ label: pw.solarPanelWatts ? `Solar ${pw.solarPanelWatts}W` : 'Solar', accent: true });
    for (const item of d.hardware?.input ?? []) {
      if (item.type === 'keyboard') out.push({ label: 'Keyboard' });
      else if (item.type === 'trackball') out.push({ label: 'Trackball' });
      else if (item.type === 'joystick') out.push({ label: 'Joystick' });
    }
    return out;
  }

  // --- Label helpers ---------------------------------------------------------
  const humanize = (v) =>
    String(v).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const DISPLAY_LABELS = { oled: 'OLED', 'e-paper': 'E-Paper', 'e-ink': 'E-Ink', display: 'LCD' };
  const TRANSPORT_LABELS = { ble: 'BLE', usb: 'USB', tcp: 'TCP', wifi: 'Wi-Fi', ethernet: 'Ethernet', serial: 'Serial' };

  // --- Facet definitions -----------------------------------------------------
  // Each facet extracts the set of values a device carries; selecting values
  // keeps devices whose set intersects the selection (OR within a facet, AND
  // across facets). `primary` facets show by default; the rest live under
  // "Advanced". Facets with no options are hidden automatically.
  const displayTech = (d) => {
    const dp = d.hardware?.display;
    return dp?.status === 'present' && dp.technology && dp.technology !== 'unknown'
      ? [dp.technology]
      : [];
  };
  const FACETS = [
    { id: 'mcu', label: 'MCU', primary: true, get: (d) => { const f = deviceFamily(d); return f && f !== 'Unknown' ? [f] : []; } },
    { id: 'radio', label: m.dev_facet_radio(), primary: true, get: deviceChips, fmt: (v) => v.toUpperCase() },
    { id: 'roles', label: m.dev_facet_roles(), get: (d) => d.roles ?? [], fmt: nodeRoleLabel },
    { id: 'vendor', label: m.dev_facet_vendor(), get: (d) => (d.vendorName ? [d.vendorName] : []) },
    { id: 'arch', label: 'Arch', get: (d) => { const a = resolveMcuInfo(d)?.architecture?.name; return a ? [a] : []; } },
    { id: 'band', label: m.dev_facet_band(), get: (d) => [...new Set((d.hardware?.radios ?? []).flatMap((r) => r.bands ?? []))], fmt: (v) => bandLabel(v) ?? `${v}` },
    { id: 'transports', label: m.dev_facet_link(), get: (d) => d.transports ?? [], fmt: (v) => TRANSPORT_LABELS[v] ?? humanize(v) },
    { id: 'kind', label: m.dev_facet_kind(), get: (d) => (d.kind ? [d.kind] : []), fmt: humanize },
    { id: 'lifecycle', label: m.dev_facet_status(), get: (d) => (d.lifecycle ? [d.lifecycle] : []), fmt: deviceLifecycleLabel },
    { id: 'display', label: m.dev_facet_screen(), get: displayTech, fmt: (v) => DISPLAY_LABELS[v] ?? humanize(v) },
    { id: 'connector', label: 'USB', get: (d) => { const c = d.interfaces?.usb?.connector; return c ? [c] : []; } },
    { id: 'source', label: m.dev_facet_source(), get: (d) => (d.flasherListed ? [m.dev_facet_source_in_flasher()] : []) }
  ];

  // --- Boolean capability toggles --------------------------------------------
  const TOGGLES = [
    { id: 'gps', label: 'GPS', test: (d) => d.hardware?.gnss?.status === 'present' },
    { id: 'screen', label: m.dev_tog_display(), test: (d) => d.hardware?.display?.status === 'present' },
    { id: 'battery', label: m.dev_tog_battery(), test: (d) => d.hardware?.power?.batterySupported === true },
    { id: 'solarPanel', label: m.dev_tog_solar_panel(), test: (d) => d.hardware?.power?.solarPanelBuiltIn === true },
    { id: 'solarInput', label: m.dev_tog_solar_input(), test: (d) => d.hardware?.power?.solarInput === true },
    { id: 'charging', label: m.dev_tog_charging(), test: (d) => d.hardware?.power?.charging === true },
    { id: 'touch', label: m.dev_tog_touch(), test: (d) => d.hardware?.display?.touch === true },
    { id: 'wifi', label: 'Wi-Fi', test: (d) => d.interfaces?.wifi?.status === 'present' },
    { id: 'bluetooth', label: 'Bluetooth', test: (d) => d.interfaces?.bluetooth?.ble === true },
    { id: 'waterproof', label: m.dev_tog_ip(), test: (d) => !!d.hardware?.enclosure?.ipRating },
    { id: 'enclosure', label: m.dev_tog_enclosure(), test: (d) => d.hardware?.enclosure?.builtIn === true }
  ];

  // --- Numeric range filters -------------------------------------------------
  const RANGES = [
    { id: 'price', label: m.dev_range_price(), unit: '$', get: (d) => d.price?.amount },
    { id: 'flash', label: 'Flash', unit: 'MB', get: (d) => d.hardware?.mcu?.flashMb },
    { id: 'psram', label: 'PSRAM', unit: 'MB', get: (d) => d.hardware?.mcu?.psramMb },
    { id: 'battery', label: m.dev_range_battery(), unit: 'mAh', get: (d) => d.hardware?.power?.batteryCapacityMah },
    { id: 'tx', label: m.dev_range_tx(), unit: 'dBm', get: (d) => Math.max(...(d.hardware?.radios ?? []).map((r) => r.txPowerDbm).filter((v) => v != null), -Infinity) }
  ];
  const rangeVal = (d, r) => {
    const v = r.get(d);
    return v == null || v === -Infinity ? null : v;
  };

  // Tally distinct values → [value, count], most common first.
  function tally(values) {
    const m = new Map();
    for (const v of values) if (v != null && v !== '') m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  }

  // The routed category is the primary filter: facet options, their counts and
  // the available toggles all reflect only the devices in the active category, so
  // the panel never offers a filter that can't match.
  let categoryBase = $derived(
    activeCategory === 'all' ? devices : devices.filter((d) => d.category === activeCategory)
  );
  let facetOptions = $derived(
    Object.fromEntries(FACETS.map((f) => [f.id, tally(categoryBase.flatMap(f.get))]))
  );
  let availableToggles = $derived(new Set(TOGGLES.filter((t) => categoryBase.some(t.test)).map((t) => t.id)));

  // --- Filter state (synced to / from the URL, so a filtered view is shareable
  // and bookmarkable). State starts at its defaults so the first client render
  // matches the prerendered (unfiltered) HTML; the URL is read in onMount, after
  // hydration. Reading it at init instead caused a server/client mismatch: the
  // keyed each claims server DOM in document order during hydration, so the wrong
  // cards got paired and their images stuck on the wrong devices. -------------
  let query = $state('');
  let advanced = $state(false);
  let sort = $state('name');
  let hydrated = $state(false);

  // Sort options. `cmp` orders two devices; null-valued devices always sink to
  // the bottom regardless of direction.
  const numAsc = (get) => (a, b) => nullLast(get(a), get(b), (x, y) => x - y);
  const numDesc = (get) => (a, b) => nullLast(get(a), get(b), (x, y) => y - x);
  function nullLast(a, b, cmp) {
    const an = a == null, bn = b == null;
    if (an && bn) return 0;
    if (an) return 1;
    if (bn) return -1;
    return cmp(a, b);
  }
  // A `metric` carries the accessor + formatter for a numeric sort. When such a
  // sort is active the card surfaces that value (see sortBadge) so the ordering
  // is legible even for specs not normally shown on the card.
  const numSort = (id, label, dir, metric) => ({
    id,
    label,
    metric,
    cmp: (dir === 'asc' ? numAsc : numDesc)(metric.get)
  });
  const SORTS = [
    { id: 'name', label: m.dev_sort_name(), cmp: (a, b) => a.name.localeCompare(b.name) },
    { id: 'price-asc', label: m.dev_sort_price_asc(), cmp: numAsc((d) => d.price?.amount) },
    { id: 'price-desc', label: m.dev_sort_price_desc(), cmp: numDesc((d) => d.price?.amount) },
    { id: 'firmwares', label: m.dev_sort_firmwares(), cmp: numDesc((d) => d.firmwareCount) },
    { id: 'mcu', label: 'MCU', cmp: (a, b) => deviceMcuLabel(a).localeCompare(deviceMcuLabel(b)) || a.name.localeCompare(b.name) },
    numSort('battery', m.dev_sort_battery(), 'desc', {
      label: m.dev_metric_battery(), get: (d) => d.hardware?.power?.batteryCapacityMah, fmt: (v) => `${v} mAh`
    }),
    numSort('solar', m.dev_sort_solar(), 'desc', {
      label: m.dev_metric_solar(), get: (d) => d.hardware?.power?.solarPanelWatts, fmt: (v) => `${v} W`
    }),
    numSort('idle', m.dev_sort_idle(), 'asc', {
      label: m.dev_metric_idle(), get: (d) => d.hardware?.power?.consumptionIdleMa, fmt: (v) => `${v} mA`
    }),
    numSort('tx', m.dev_sort_tx(), 'asc', {
      label: m.dev_metric_tx(), get: (d) => d.hardware?.power?.consumptionTxMa, fmt: (v) => `${v} mA`
    })
  ];
  let sel = $state(Object.fromEntries(FACETS.map((f) => [f.id, []])));
  let toggles = $state(Object.fromEntries(TOGGLES.map((t) => [t.id, false])));
  let ranges = $state(Object.fromEntries(RANGES.map((r) => [r.id, { min: '', max: '' }])));

  // Hydrate filter state from the URL once, after the first (SSR-matching)
  // render, then start syncing it back. Doing this at init instead would diverge
  // from the prerendered HTML and corrupt hydration (see the filter-state note).
  onMount(() => {
    const p = new URLSearchParams(location.search);
    const csv = (key) => (p.get(key) ?? '').split(',').filter(Boolean);
    query = p.get('q') ?? '';
    advanced = p.get('adv') === '1';
    sort = p.get('sort') ?? 'name';
    sel = Object.fromEntries(FACETS.map((f) => [f.id, csv(f.id)]));
    toggles = Object.fromEntries(TOGGLES.map((t) => [t.id, csv('has').includes(t.id)]));
    ranges = Object.fromEntries(
      RANGES.map((r) => {
        const [min = '', max = ''] = (p.get(r.id) ?? '').split(',');
        return [r.id, { min, max }];
      })
    );
    hydrated = true;
  });

  function toggleFacet(id, value) {
    const cur = sel[id];
    sel[id] = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  }

  const numSet = (v) => v !== '' && v != null && !Number.isNaN(Number(v));
  const rangeActive = (r) => numSet(ranges[r.id].min) || numSet(ranges[r.id].max);

  let activeCount = $derived(
    FACETS.reduce((n, f) => n + sel[f.id].length, 0) +
      TOGGLES.reduce((n, t) => n + (toggles[t.id] ? 1 : 0), 0) +
      RANGES.reduce((n, r) => n + (rangeActive(r) ? 1 : 0), 0)
  );

  // Whether any advanced control is in use — keeps the section open on reload
  // if it carries active filters, and flags it when collapsed.
  let advancedActive = $derived(
    FACETS.some((f) => !f.primary && sel[f.id].length) ||
      TOGGLES.some((t) => !t.primary && toggles[t.id]) ||
      RANGES.some((r) => rangeActive(r))
  );

  function clearAll() {
    query = '';
    sel = Object.fromEntries(FACETS.map((f) => [f.id, []]));
    toggles = Object.fromEntries(TOGGLES.map((t) => [t.id, false]));
    ranges = Object.fromEntries(RANGES.map((r) => [r.id, { min: '', max: '' }]));
  }

  let filtered = $derived(
    categoryBase.filter((d) => {
      if (query.trim() && !deviceSearchText(d).includes(query.toLowerCase())) return false;
      for (const f of FACETS) {
        const s = sel[f.id];
        if (s.length && !f.get(d).some((v) => s.includes(v))) return false;
      }
      for (const t of TOGGLES) if (toggles[t.id] && !t.test(d)) return false;
      for (const r of RANGES) {
        if (!rangeActive(r)) continue;
        const v = rangeVal(d, r);
        if (v == null) return false;
        if (numSet(ranges[r.id].min) && v < Number(ranges[r.id].min)) return false;
        if (numSet(ranges[r.id].max) && v > Number(ranges[r.id].max)) return false;
      }
      return true;
    })
  );

  const sortItems = SORTS.map((s) => ({ value: s.id, label: s.label }));
  let activeSort = $derived(SORTS.find((s) => s.id === sort) ?? SORTS[0]);
  let sorted = $derived([...filtered].sort(activeSort.cmp));
  let favoriteDevices = $derived($favoriteIds.map((id) => devices.find((d) => d.id === id)).filter(Boolean));

  // Grouped "All" view: with no category selected and nothing else narrowing the
  // list, the grid is split into category sections (like Software/Firmwares), in
  // CATEGORY_ORDER, name-sorted within each. A category tab, any facet/toggle/
  // range, or a search collapses it to one flat, sortable grid — so the Sort
  // control only appears in that collapsed view.
  let collapsed = $derived(activeCategory !== 'all' || query.trim().length > 0 || activeCount > 0);
  let categoryGroups = $derived(
    CATEGORY_ORDER.map((c) => ({
      category: c,
      label: CATEGORY_LABELS[c],
      items: filtered.filter((d) => d.category === c).sort((a, b) => a.name.localeCompare(b.name))
    })).filter((g) => g.items.length)
  );

  // When a metric sort is active, the value to surface on each card (or null).
  function sortBadge(d) {
    const m = activeSort.metric;
    if (!m) return null;
    const v = m.get(d);
    return v == null ? null : `${m.label}: ${m.fmt(v)}`;
  }

  const primaryFacets = FACETS.filter((f) => f.primary);
  const advancedFacets = FACETS.filter((f) => !f.primary);
  // Only toggles that can match something in the active category are offered.
  let primaryToggles = $derived(TOGGLES.filter((t) => t.primary && availableToggles.has(t.id)));
  let advancedToggles = $derived(TOGGLES.filter((t) => !t.primary && availableToggles.has(t.id)));

  const rowLabel = 'w-14 shrink-0 pt-1 text-[0.7rem] tracking-wide text-dim uppercase';

  // Reflect the active filters into the query string so a filtered view is
  // shareable. Native history.replaceState keeps it a pure URL-bar update — no
  // navigation, no scroll, no history entries, and no dependence on the router.
  $effect(() => {
    // Wait until onMount has applied the URL → state, or the first run would
    // immediately overwrite the incoming query string with empty defaults.
    if (!browser || !hydrated) return;
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    for (const f of FACETS) if (sel[f.id].length) p.set(f.id, sel[f.id].join(','));
    const has = TOGGLES.filter((t) => toggles[t.id]).map((t) => t.id);
    if (has.length) p.set('has', has.join(','));
    for (const r of RANGES)
      if (rangeActive(r)) p.set(r.id, `${ranges[r.id].min},${ranges[r.id].max}`);
    if (advanced) p.set('adv', '1');
    if (sort !== 'name') p.set('sort', sort);
    const qs = p.toString();
    history.replaceState(history.state, '', qs ? `${location.pathname}?${qs}` : location.pathname);
  });
</script>

<PageHeader collection="devices">
  {#snippet actions()}
    <ToolLink id="device-rank" short />
    <ToolLink id="gallery" short />
    <CollectionLink id="vendors" />
  {/snippet}
  {m.dev_list_subtitle()}
</PageHeader>

{#if favoriteDevices.length}
  <section class="mb-4 rounded-xl border border-accent/35 bg-accent/10 p-4">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-[0.95rem] font-semibold">{m.dev_list_favourites()}</h2>
      <a
        class="text-[0.8rem] text-accent2 hover:underline"
        href={href(`/compare/?ids=${favoriteDevices.map((d) => d.id).join(',')}`)}
        onclick={() => compareIds.set(favoriteDevices.map((d) => d.id))}
      >
        {m.dev_list_compare_favourites()}
      </a>
    </div>
    <div class="flex gap-2 overflow-x-auto pb-1">
      {#each favoriteDevices as fav (fav.id)}
        <a
          class="group flex min-w-[210px] items-center gap-2 rounded-lg border border-edge bg-elev p-2 transition hover:border-accent"
          href={href(`/device/${fav.id}/`)}
        >
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-elev2 p-1 text-muted">
            {#if fav.imageUrl}
              <img src={fav.imageUrl} alt="" class="max-h-full max-w-full object-contain" />
            {:else}
              <span class="font-mono text-[0.55rem]">{deviceMcuLabel(fav)}</span>
            {/if}
          </span>
          <span class="min-w-0">
            <span class="block truncate text-[0.85rem] font-medium group-hover:text-accent">{fav.name}</span>
            <span class="block truncate text-[0.72rem] text-dim">{deviceMcuLabel(fav)}</span>
          </span>
        </a>
      {/each}
    </div>
  </section>
{/if}

<!-- Category — links so each view is its own prerendered, indexable route. -->
<div class="mb-3 flex flex-wrap gap-1.5">
  <a
    href={href('/devices/')}
    class="rounded-md border px-2.5 py-1 text-[0.78rem] font-medium transition {activeCategory === 'all'
      ? 'border-accent bg-accent/15 text-accent'
      : 'border-edge text-dim hover:text-ink'}"
  >{m.filter_all()} <span class="text-dim">({devices.length})</span></a>
  {#each CATEGORY_ORDER as c (c)}
    <a
      href={href(`/devices/${c}/`)}
      class="rounded-md border px-2.5 py-1 text-[0.78rem] font-medium transition {activeCategory === c
        ? 'border-accent bg-accent/15 text-accent'
        : 'border-edge text-dim hover:text-ink'}"
    >{CATEGORY_LABELS[c]}</a>
  {/each}
</div>

<input
  type="search"
  placeholder={m.dev_list_search()}
  bind:value={query}
  class="w-full rounded-lg border border-edge bg-bg px-3 py-2.5 text-[0.95rem] outline-none focus:border-transparent focus:ring-2 focus:ring-accent"
/>

<!-- Faceted filters -->
<div class="mt-4 space-y-3 rounded-xl border border-edge bg-elev p-4">
  {#each primaryFacets as f (f.id)}
    {#if facetOptions[f.id].length}
      <div class="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span class={rowLabel}>{f.label}</span>
        <div class="flex flex-1 flex-wrap gap-1.5">
          {#each facetOptions[f.id] as [value, count] (value)}
            <Chip pressed={sel[f.id].includes(value)} onPressedChange={() => toggleFacet(f.id, value)}>
              {f.fmt ? f.fmt(value) : value} <span class="opacity-60">{count}</span>
            </Chip>
          {/each}
        </div>
      </div>
    {/if}
  {/each}

  {#if primaryToggles.length}
    <div class="flex flex-wrap items-start gap-x-3 gap-y-2">
      <span class={rowLabel}>{m.filter_has()}</span>
      <div class="flex flex-1 flex-wrap gap-1.5">
        {#each primaryToggles as t (t.id)}
          <Chip pressed={toggles[t.id]} onPressedChange={() => (toggles[t.id] = !toggles[t.id])}>{t.label}</Chip>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Advanced section -->
  <Collapsible.Root bind:open={advanced} class="border-t border-edge pt-3">
    <Collapsible.Trigger
      class="flex items-center gap-1.5 text-[0.8rem] font-medium text-dim outline-none hover:text-ink"
    >
      <span class="inline-block transition-transform {advanced ? 'rotate-90' : ''}">▸</span>
      {m.filter_advanced()}
      {#if advancedActive && !advanced}
        <span class="rounded-full bg-accent/15 px-1.5 text-[0.7rem] text-accent">{m.filter_active()}</span>
      {/if}
    </Collapsible.Trigger>

    <Collapsible.Content>
      <div class="mt-3 space-y-3">
        {#each advancedFacets as f (f.id)}
          {#if facetOptions[f.id].length}
            <div class="flex flex-wrap items-start gap-x-3 gap-y-2">
              <span class={rowLabel}>{f.label}</span>
              <div class="flex flex-1 flex-wrap gap-1.5">
                {#each facetOptions[f.id] as [value, count] (value)}
                  <Chip pressed={sel[f.id].includes(value)} onPressedChange={() => toggleFacet(f.id, value)}>
                    {f.fmt ? f.fmt(value) : value} <span class="opacity-60">{count}</span>
                  </Chip>
                {/each}
              </div>
            </div>
          {/if}
        {/each}

        {#if advancedToggles.length}
          <div class="flex flex-wrap items-start gap-x-3 gap-y-2">
            <span class={rowLabel}>{m.filter_has()}</span>
            <div class="flex flex-1 flex-wrap gap-1.5">
              {#each advancedToggles as t (t.id)}
                <Chip pressed={toggles[t.id]} onPressedChange={() => (toggles[t.id] = !toggles[t.id])}>{t.label}</Chip>
              {/each}
            </div>
          </div>
        {/if}

        <div class="flex flex-wrap items-start gap-x-3 gap-y-2">
          <span class={rowLabel}>{m.filter_range()}</span>
          <div class="flex flex-1 flex-wrap gap-2">
            {#each RANGES as r (r.id)}
              <div class="flex items-center gap-1 rounded-lg border px-2 py-1 text-[0.8rem] {rangeActive(r) ? 'border-accent/60' : 'border-edge'}">
                <span class="text-dim">{r.label}</span>
                <input
                  type="number"
                  inputmode="numeric"
                  placeholder={m.filter_min()}
                  bind:value={ranges[r.id].min}
                  class="w-12 bg-transparent text-right outline-none placeholder:text-dim/50"
                />
                <span class="text-dim">–</span>
                <input
                  type="number"
                  inputmode="numeric"
                  placeholder={m.filter_max()}
                  bind:value={ranges[r.id].max}
                  class="w-12 bg-transparent text-right outline-none placeholder:text-dim/50"
                />
                <span class="text-[0.7rem] text-dim">{r.unit}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </Collapsible.Content>
  </Collapsible.Root>
</div>

<div class="my-3 flex items-center gap-3 text-[0.85rem] text-dim">
  <span>{pluralize(filtered.length, 'device')}</span>
  {#if activeCount}
    <Button variant="link" size="sm" class="px-0" onclick={clearAll}>{m.filter_clear({ count: activeCount })}</Button>
  {/if}
  {#if collapsed}
    <div class="ml-auto flex items-center gap-1.5">
      <span class="text-dim">{m.filter_sort()}</span>
      <Select items={sortItems} bind:value={sort} placeholder="Sort" class="min-w-44" />
    </div>
  {/if}
</div>

{#snippet deviceCard(d)}
      <Card href={href(`/device/${d.id}/`)} class="flex flex-col p-3">
        <div class="relative mb-3 flex h-[120px] items-center justify-center overflow-hidden rounded-lg bg-elev2">
          {#if d.imageUrl}
            <img src={d.imageUrl} alt={d.name} loading="lazy" class="max-h-full max-w-full object-contain p-3 transition group-hover:scale-105" />
          {:else}
            <span class="font-mono text-[0.8rem] text-dim">{deviceMcuLabel(d)}</span>
          {/if}
          <Button
            variant=""
            size="none"
            aria-label={m.aria_compare({ name: d.name })}
            aria-pressed={$compareIds.includes(d.id)}
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleCompare(d.id);
            }}
            class="absolute top-2 left-2 h-6 gap-1 rounded-md border px-1.5 text-[0.68rem] font-medium transition {$compareIds.includes(
              d.id
            )
              ? 'border-accent bg-accent text-bg'
              : 'border-edge bg-elev/80 text-dim opacity-0 group-hover:opacity-100 hover:text-ink'}"
          >
            {$compareIds.includes(d.id) ? m.compare_on() : m.compare_off()}
          </Button>
          <Button
            variant=""
            size="none"
            aria-label={m.aria_favourite_toggle({ name: d.name })}
            title={$favoriteIds.includes(d.id) ? m.favourite_remove() : m.favourite_add()}
            aria-pressed={$favoriteIds.includes(d.id)}
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite(d.id);
            }}
            class="absolute top-2 right-2 h-7 w-7 justify-center rounded-md border text-[0.95rem] leading-none transition {$favoriteIds.includes(
              d.id
            )
              ? 'border-accent bg-accent text-bg'
              : 'border-edge bg-elev/80 text-dim opacity-0 group-hover:opacity-100 hover:text-ink'}"
          >
            {$favoriteIds.includes(d.id) ? '★' : '☆'}
          </Button>
        </div>

        <div class="px-1">
          <h2 class="text-[1.02rem] leading-tight font-semibold">{d.name}</h2>
          {#if d.vendorName}<span class="text-[0.8rem] text-dim">{d.vendorName}</span>{/if}

          <div class="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[0.8rem] text-dim">
            <span class="text-ink">{deviceMcuLabel(d)}</span>
            {#if radioShort(d)}<span class="text-edge">·</span><span>{radioShort(d)}</span>{/if}
          </div>
        </div>

        <!-- Pills + footer pinned to the card bottom; the gap above grows so
             cards in a row keep their footers aligned regardless of content. -->
        <div class="mt-auto">
          {#if sortBadge(d) || featurePills(d).length}
            <div class="flex flex-wrap gap-1 px-1 pt-2.5">
              {#if sortBadge(d)}
                <span class="rounded-full border border-accent bg-accent/20 px-2 py-0.5 text-[0.7rem] font-medium text-accent">{sortBadge(d)}</span>
              {/if}
              {#each featurePills(d) as pill}
                <span class="rounded-full border px-2 py-0.5 text-[0.7rem] {pill.accent ? 'border-accent/40 bg-accent/10 text-accent' : 'border-edge bg-elev2 text-dim'}">{pill.label}</span>
              {/each}
            </div>
          {/if}

          <div class="mt-2.5 flex items-center justify-between border-t border-edge px-1 pt-2.5 text-[0.78rem] text-dim">
          <span>{pluralize(d.firmwareCount, 'firmware')}</span>
          {#if devicePriceLabel(d)}
            <span class="font-semibold text-ink">{devicePriceLabel(d)}</span>
          {:else}
            <span class="text-accent opacity-0 transition group-hover:opacity-100">{m.card_view()}</span>
          {/if}
          </div>
        </div>
      </Card>
{/snippet}

{#snippet cardGrid(items)}
  <div class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
    {#each items as d (d.id)}
      {@render deviceCard(d)}
    {/each}
  </div>
{/snippet}

{#if !filtered.length}
  <p class="rounded-xl border border-edge bg-elev p-8 text-center text-dim">{m.dev_list_empty()}</p>
{:else if collapsed}
  {@render cardGrid(sorted)}
{:else}
  <div class="flex flex-col gap-9">
    {#each categoryGroups as g (g.category)}
      <section>
        <h2 class="mb-3 flex items-baseline gap-2 border-b border-edge pb-1.5 text-[1.1rem] font-semibold">
          {g.label}
          <span class="text-[0.85rem] font-normal text-dim">{g.items.length}</span>
        </h2>
        {@render cardGrid(g.items)}
      </section>
    {/each}
  </div>
{/if}

<CompareBar
  count={$compareIds.length}
  href={href(`/compare/?ids=${$compareIds.join(',')}`)}
  onclear={clearCompare}
/>
