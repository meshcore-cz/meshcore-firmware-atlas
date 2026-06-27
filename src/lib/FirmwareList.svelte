<script>
  // Shared firmware catalogue: search box, a faceted filter panel (Scope first,
  // then roles/type/link, with the rest under "Advanced"), and the card grid.
  // With no filter active the grid is grouped into scope sections; the moment any
  // facet, toggle or the search box narrows the list the groups collapse into one
  // flat grid. All filter state is mirrored to the URL so views are shareable.
  import { href } from '$lib/i18n.js';
  import { m } from '$lib/paraglide/messages.js';
  import { TYPE_META, LICENSE_TYPE_META, licenseType, descriptionToPlain, firmwareTypeLabel, licenseTypeLabel, nodeRoleLabel, firmwareStatusLabel, firmwareMaturityLabel, firmwareDistributionLabel } from '$lib/data.js';
  import { pluralize, displayVersion, relativeTime, fullDateTime, releaseFreshnessTone } from '$lib/format.js';
  import Button from '$lib/Button.svelte';
  import Chip from '$lib/Chip.svelte';
  import PageHeader from '$lib/PageHeader.svelte';
  import ToolLink from '$lib/ToolLink.svelte';
  import Card from '$lib/Card.svelte';
  import CompareBar from '$lib/CompareBar.svelte';
  import { fwCompareIds, toggleFwCompare, clearFwCompare } from '$lib/fwCompare.js';
  import { Collapsible } from 'bits-ui';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  // `activeScope` comes from the route (/firmwares/ or /firmwares/<scope>/) so
  // each scope view is its own prerendered, indexable page.
  let { firmwares, activeScope = 'all' } = $props();

  // Subtitle embeds a link to /devices/, injected into the message placeholder.
  let devicesLink = $derived(
    `<a class="text-accent2 hover:underline" href="${href('/devices/')}">${m.fw_list_subtitle_devices()}</a>`
  );

  // The scope axis is the primary grouping, rendered top to bottom in this order.
  const SCOPE_ORDER = ['universal', 'platform-specific', 'function-specific', 'device-specific'];
  const SCOPE_META = {
    universal: { label: m.fw_scope_universal_title(), blurb: m.fw_scope_universal_blurb() },
    'platform-specific': { label: m.fw_scope_platform_title(), blurb: m.fw_scope_platform_blurb() },
    'function-specific': { label: m.fw_scope_function_title(), blurb: m.fw_scope_function_blurb() },
    'device-specific': { label: m.fw_scope_device_title(), blurb: m.fw_scope_device_blurb() }
  };

  // --- Label helpers ---------------------------------------------------------
  const humanize = (v) => String(v).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const SCOPE_LABELS = {
    universal: m.fw_scope_universal(),
    'platform-specific': m.fw_scope_platform(),
    'function-specific': m.fw_scope_function(),
    'device-specific': m.fw_scope_device()
  };
  const ROLE_LABELS = {
    companion: nodeRoleLabel('companion'),
    repeater: nodeRoleLabel('repeater'),
    observer: nodeRoleLabel('observer'),
    sensor: nodeRoleLabel('sensor'),
    'room-server': nodeRoleLabel('room-server'),
    'kiss-modem': nodeRoleLabel('kiss-modem'),
    'standalone-ui': nodeRoleLabel('standalone-ui')
  };
  const TRANSPORT_LABELS = { ble: 'BLE', usbSerial: 'USB', nativeTcp: 'TCP', wifiAp: 'Wi-Fi', ethernet: 'Ethernet' };
  const capsOn = (obj) => Object.entries(obj ?? {}).filter(([, v]) => v).map(([k]) => k);

  // --- Facets ----------------------------------------------------------------
  // Each facet extracts the values a firmware carries; selecting values keeps
  // firmwares whose set intersects the selection (OR within a facet, AND across
  // facets). `primary` facets show by default; the rest live under "Advanced".
  // Empty facets hide automatically.
  const FACETS = [
    { id: 'type', label: m.fw_facet_type(), primary: true, get: (f) => (f.type ? [f.type] : []), fmt: (v) => firmwareTypeLabel(v) },
    { id: 'roles', label: m.fw_facet_roles(), primary: true, get: (f) => f.roles ?? [], fmt: (v) => ROLE_LABELS[v] ?? humanize(v) },
    { id: 'transports', label: m.fw_facet_link(), get: (f) => capsOn(f.capabilities?.transports), fmt: (v) => TRANSPORT_LABELS[v] ?? humanize(v) },
    { id: 'group', label: m.fw_facet_group(), get: (f) => (f.scopeGroup ? [f.scopeGroup] : []) },
    { id: 'license', label: m.fw_facet_license(), get: (f) => { const l = licenseType(f); return l ? [l] : []; }, fmt: (v) => licenseTypeLabel(v) },
    { id: 'framework', label: m.fw_facet_runtime(), get: (f) => (f.runtime?.framework ? [f.runtime.framework] : []), fmt: humanize },
    { id: 'status', label: m.fw_facet_status(), get: (f) => (f.status ? [f.status] : []), fmt: firmwareStatusLabel },
    { id: 'maturity', label: m.fw_facet_maturity(), get: (f) => (f.maturity ? [f.maturity] : []), fmt: firmwareMaturityLabel },
    { id: 'distribution', label: m.fw_facet_dist(), get: (f) => (f.distribution ? [f.distribution] : []), fmt: firmwareDistributionLabel }
  ];

  // --- Boolean capability toggles --------------------------------------------
  const TOGGLES = [
    { id: 'gps', label: 'GPS', test: (f) => f.capabilities?.hardware?.gps === true },
    { id: 'display', label: m.fw_tog_display(), test: (f) => f.capabilities?.hardware?.display === true },
    { id: 'ota', label: 'OTA', test: (f) => f.capabilities?.operations?.ota === true },
    { id: 'webFlasher', label: m.fw_tog_web_flasher(), test: (f) => f.capabilities?.operations?.webFlasher === true },
    { id: 'mqtt', label: 'MQTT', test: (f) => f.capabilities?.networking?.mqtt === true },
    { id: 'sensors', label: m.fw_tog_sensors(), test: (f) => f.capabilities?.hardware?.sensors === true },
    { id: 'lowPowerRx', label: m.fw_tog_low_power_rx(), test: (f) => f.capabilities?.hardware?.lowPowerRx === true },
    { id: 'bleDfu', label: 'BLE DFU', test: (f) => f.capabilities?.operations?.bleDfu === true },
    { id: 'configBackup', label: m.fw_tog_config_backup(), test: (f) => f.capabilities?.operations?.configurationBackup === true }
  ];

  // Tally distinct values → [value, count], most common first.
  function tally(values) {
    const m = new Map();
    for (const v of values) if (v != null && v !== '') m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  }
  // The routed scope is the primary filter: facet options, their counts and the
  // available toggles all reflect only the firmwares in the active scope, so the
  // panel never offers a filter that can't match.
  let scopeBase = $derived(
    activeScope === 'all'
      ? firmwares
      : firmwares.filter((fw) => (fw.scope ?? 'device-specific') === activeScope)
  );
  let facetOptions = $derived(Object.fromEntries(FACETS.map((f) => [f.id, tally(scopeBase.flatMap(f.get))])));
  let availableToggles = $derived(new Set(TOGGLES.filter((t) => scopeBase.some(t.test)).map((t) => t.id)));

  // --- Filter state (mirrored to / from the URL). Starts at defaults so the
  // first client render matches the prerendered HTML; the URL is read in onMount,
  // after hydration. ----------------------------------------------------------
  let query = $state('');
  let advanced = $state(false);
  let hydrated = $state(false);
  let sel = $state(Object.fromEntries(FACETS.map((f) => [f.id, []])));
  let toggles = $state(Object.fromEntries(TOGGLES.map((t) => [t.id, false])));

  onMount(() => {
    const p = new URLSearchParams(location.search);
    const csv = (key) => (p.get(key) ?? '').split(',').filter(Boolean);
    query = p.get('q') ?? '';
    advanced = p.get('adv') === '1';
    sel = Object.fromEntries(FACETS.map((f) => [f.id, csv(f.id)]));
    toggles = Object.fromEntries(TOGGLES.map((t) => [t.id, csv('has').includes(t.id)]));
    hydrated = true;
  });

  function toggleFacet(id, value) {
    const cur = sel[id];
    sel[id] = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  }

  let activeCount = $derived(
    FACETS.reduce((n, f) => n + sel[f.id].length, 0) + TOGGLES.reduce((n, t) => n + (toggles[t.id] ? 1 : 0), 0)
  );
  let advancedActive = $derived(
    FACETS.some((f) => !f.primary && sel[f.id].length) || TOGGLES.some((t) => !t.primary && toggles[t.id])
  );

  function clearAll() {
    query = '';
    sel = Object.fromEntries(FACETS.map((f) => [f.id, []]));
    toggles = Object.fromEntries(TOGGLES.map((t) => [t.id, false]));
  }

  // Compact star count: 1240 → "1.2k", 980 → "980".
  function fmtStars(n) {
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  let filtered = $derived(
    firmwares.filter((fw) => {
      if (activeScope !== 'all' && (fw.scope ?? 'device-specific') !== activeScope) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hit =
          fw.name.toLowerCase().includes(q) ||
          (fw.maintainer ?? '').toLowerCase().includes(q) ||
          (fw.description ?? '').toLowerCase().includes(q) ||
          (fw.features ?? []).some((f) => f.toLowerCase().includes(q));
        if (!hit) return false;
      }
      for (const f of FACETS) {
        const s = sel[f.id];
        if (s.length && !f.get(fw).some((v) => s.includes(v))) return false;
      }
      for (const t of TOGGLES) if (toggles[t.id] && !t.test(fw)) return false;
      return true;
    })
  );

  // Collapse the scope sections into one flat grid whenever a filter narrows the
  // list — any facet, toggle, or a search query.
  let collapsed = $derived(activeCount > 0 || query.trim().length > 0);

  const primaryFacets = FACETS.filter((f) => f.primary);
  const advancedFacets = FACETS.filter((f) => !f.primary);
  // Only toggles that can match something in the active scope are offered.
  let primaryToggles = $derived(TOGGLES.filter((t) => t.primary && availableToggles.has(t.id)));
  let advancedToggles = $derived(TOGGLES.filter((t) => !t.primary && availableToggles.has(t.id)));
  const rowLabel = 'w-14 shrink-0 pt-1 text-[0.7rem] tracking-wide text-dim uppercase';

  $effect(() => {
    if (!browser || !hydrated) return;
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    for (const f of FACETS) if (sel[f.id].length) p.set(f.id, sel[f.id].join(','));
    const has = TOGGLES.filter((t) => toggles[t.id]).map((t) => t.id);
    if (has.length) p.set('has', has.join(','));
    if (advanced) p.set('adv', '1');
    const qs = p.toString();
    history.replaceState(history.state, '', qs ? `${location.pathname}?${qs}` : location.pathname);
  });

  // Build each scope section from the filtered list. filter() preserves the
  // catalogue order, so every section/sub-group keeps the active-first /
  // most-starred ranking from build-data.js. Universal renders as a flat grid;
  // the rest are bucketed by `scopeGroup` (authored scopeCategory, or the derived
  // device family), largest buckets first with a trailing "Other".
  let sections = $derived.by(() =>
    SCOPE_ORDER.map((scope) => {
      const items = filtered.filter((fw) => (fw.scope ?? 'device-specific') === scope);
      if (scope === 'universal') return { scope, items, groups: null };
      const buckets = new Map();
      for (const fw of items) {
        const key = fw.scopeGroup ?? 'Other';
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(fw);
      }
      const groups = [...buckets.entries()]
        .map(([label, list]) => ({ label, items: list }))
        .sort((a, b) =>
          (a.label === 'Other') - (b.label === 'Other') ||
          b.items.length - a.items.length ||
          a.label.localeCompare(b.label)
        );
      return { scope, items, groups };
    }).filter((s) => s.items.length)
  );
</script>

<PageHeader collection="firmwares" subtitleClass="max-w-[60ch]">
  {#snippet actions()}
    <ToolLink id="releases" to="/releases/?kind=firmware" />
    <ToolLink id="matrix" />
  {/snippet}
  {@html m.fw_list_subtitle({ devices: devicesLink })}
</PageHeader>

<!-- Scope category — links so each view is its own prerendered, indexable route. -->
<div class="mb-3 flex flex-wrap gap-1.5">
  <a
    href={href('/firmwares/')}
    class="rounded-md border px-2.5 py-1 text-[0.78rem] font-medium transition {activeScope === 'all'
      ? 'border-accent bg-accent/15 text-accent'
      : 'border-edge text-dim hover:text-ink'}"
  >{m.filter_all()} <span class="text-dim">({firmwares.length})</span></a>
  {#each SCOPE_ORDER as s (s)}
    <a
      href={href(`/firmwares/${s}/`)}
      class="rounded-md border px-2.5 py-1 text-[0.78rem] font-medium transition {activeScope === s
        ? 'border-accent bg-accent/15 text-accent'
        : 'border-edge text-dim hover:text-ink'}"
    >{SCOPE_LABELS[s]}</a>
  {/each}
</div>

<input
  type="search"
  placeholder={m.fw_list_search()}
  bind:value={query}
  class="w-full rounded-lg border border-edge bg-bg px-3 py-2.5 text-[0.95rem] outline-none focus:border-transparent focus:ring-2 focus:ring-accent"
/>

<!-- Faceted filters — Type & Roles open; the rest under Advanced. -->
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
      </div>
    </Collapsible.Content>
  </Collapsible.Root>
</div>

<div class="my-3 flex items-center gap-3 text-[0.85rem] text-dim">
  <span>{pluralize(filtered.length, 'firmware')}</span>
  {#if activeCount}
    <Button variant="link" size="sm" class="px-0" onclick={clearAll}>{m.filter_clear({ count: activeCount })}</Button>
  {/if}
</div>

{#snippet fwCard(fw)}
  {@const licensing = licenseType(fw)}
  <Card href={href(`/firmware/${fw.id}/`)} class="flex flex-col gap-2.5 p-[1.1rem]">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span class="rounded-md px-2 py-0.5 text-[0.72rem] font-bold tracking-wide uppercase {TYPE_META[fw.type]?.tw}">
          {firmwareTypeLabel(fw.type)}
        </span>
        <Button
          variant=""
          size="none"
          aria-label={m.aria_compare({ name: fw.name })}
          aria-pressed={$fwCompareIds.includes(fw.id)}
          onclick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFwCompare(fw.id);
          }}
          class="rounded-md border px-1.5 py-0.5 text-[0.66rem] font-medium transition {$fwCompareIds.includes(
            fw.id
          )
            ? 'border-accent bg-accent text-bg'
            : 'border-edge text-dim opacity-0 group-hover:opacity-100 hover:text-ink'}"
        >
          {$fwCompareIds.includes(fw.id) ? m.compare_on() : m.compare_off()}
        </Button>
      </div>
      {#if licensing}
        <span class="shrink-0 rounded-md px-1.5 py-0.5 text-[0.66rem] font-medium {LICENSE_TYPE_META[licensing]?.tw ?? ''}">
          {licenseTypeLabel(licensing)}
        </span>
      {/if}
    </div>
    <h3 class="text-[1.15rem] font-semibold">{fw.name}</h3>
    <p class="line-clamp-3 text-[0.9rem] text-dim">{descriptionToPlain(fw.description)}</p>
    <div class="mt-auto flex flex-wrap gap-1.5">
      {#each fw.roles ?? [] as role}
        <span class="rounded bg-elev2 px-2 py-0.5 text-[0.72rem] text-dim">{nodeRoleLabel(role)}</span>
      {/each}
    </div>
    <!-- Popularity / freshness footer — mirrors the Software list layout:
         stars, latest version + when, and the maintainer, all left-aligned. -->
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-edge pt-2.5 text-[0.72rem] text-dim">
      {#if fw.popularity?.githubStars != null}
        <span class="inline-flex items-center gap-1" title="{fw.popularity.githubStars.toLocaleString()} GitHub stars">
          <svg class="h-3.5 w-3.5 text-warn" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="m12 2 2.9 6.3 6.8.7-5 4.6 1.4 6.7L12 17.8 5.9 20.3l1.4-6.7-5-4.6 6.8-.7L12 2Z" />
          </svg>
          <span class="tabular-nums">{fmtStars(fw.popularity.githubStars)}</span>
        </span>
      {/if}
      {#if fw.latest_version}
        <span class="inline-flex items-center gap-1" title={fw.released ? `Released ${fullDateTime(fw.released)}` : ''}>
          <span class="font-mono text-ink/80">{displayVersion(fw.latest_version)}</span>
          {#if fw.released}<span class="text-dim/80">· <span class={releaseFreshnessTone(fw.released)}>{relativeTime(fw.released)}</span></span>{/if}
        </span>
      {/if}
      {#if fw.maintainer}
        <span class="inline-flex min-w-0 items-center gap-1">
          <svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" stroke-linecap="round" />
          </svg>
          <span class="truncate">{fw.maintainer}</span>
        </span>
      {/if}
    </div>
  </Card>
{/snippet}

{#snippet cardGrid(items)}
  <div class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
    {#each items as fw (fw.id)}
      {@render fwCard(fw)}
    {/each}
  </div>
{/snippet}

{#if collapsed}
  {#if filtered.length}
    {@render cardGrid(filtered)}
  {:else}
    <p class="text-[0.9rem] text-dim">{m.fw_list_empty()}</p>
  {/if}
{:else}
  <div class="flex flex-col gap-9">
    {#each sections as section (section.scope)}
      <section>
        <div class="mb-3 border-b border-edge pb-1.5">
          <h2 class="text-[1.1rem] font-semibold">
            {SCOPE_META[section.scope].label}
            <span class="ml-1 text-[0.85rem] font-normal text-dim">{section.items.length}</span>
          </h2>
          <p class="mt-0.5 text-[0.8rem] text-dim">{SCOPE_META[section.scope].blurb}</p>
        </div>
        {#if section.groups}
          <div class="flex flex-col gap-7">
            {#each section.groups as group (group.label)}
              <div>
                <h3 class="mb-2.5 text-[0.95rem] font-semibold text-ink/90">
                  {group.label === 'Other' ? m.misc_other() : group.label}
                  <span class="ml-1 text-[0.8rem] font-normal text-dim">{group.items.length}</span>
                </h3>
                {@render cardGrid(group.items)}
              </div>
            {/each}
          </div>
        {:else}
          {@render cardGrid(section.items)}
        {/if}
      </section>
    {/each}
  </div>
{/if}

<CompareBar
  count={$fwCompareIds.length}
  href={href(`/compare-firmwares/?ids=${$fwCompareIds.join(',')}`)}
  onclear={clearFwCompare}
/>
