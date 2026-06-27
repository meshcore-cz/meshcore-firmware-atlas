<script>
  import { href } from '$lib/i18n.js';
  import { m } from '$lib/paraglide/messages.js';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { TYPE_META, LICENSE_TYPE_META, licenseType, getFirmware, firmwareTypeLabel, nodeRoleLabel, FIRMWARE_CAPABILITY_GROUPS, firmwareCapabilityGroupLabel, firmwareCapabilityItemLabel, firmwareStatusLabel, firmwareMaturityLabel, firmwareLifecycleLabel, firmwareDistributionLabel } from '$lib/data.js';
  import { fwCompareIds } from '$lib/fwCompare.js';
  import { pluralize } from '$lib/format.js';
  import Seo from '$lib/Seo.svelte';
  import PageHeader from '$lib/PageHeader.svelte';
  import Button from '$lib/Button.svelte';

  let { data } = $props();
  let byId = $derived(new Map(data.firmwares.map((f) => [f.id, f])));

  // Selection comes from the URL (sharable); the store is kept in sync. Read
  // searchParams in the browser only — they're absent during static prerender.
  let ids = $derived(
    browser ? ($page.url.searchParams.get('ids') ?? '').split(',').filter(Boolean) : []
  );
  let selected = $derived(ids.map((id) => byId.get(id)).filter(Boolean));

  let onlyDiff = $state(false);

  $effect(() => {
    fwCompareIds.set(ids);
  });

  function setIds(next) {
    const qs = next.length ? `?ids=${next.join(',')}` : '';
    goto(href(`/compare-firmwares/${qs}`), { replaceState: true, keepFocus: true, noScroll: true });
  }
  const remove = (id) => setIds(ids.filter((x) => x !== id));

  const DASH = '—';
  const txt = (v) => (v == null || v === '' || v === 'unknown' ? DASH : String(v));
  const numberFmt = new Intl.NumberFormat('en');
  const num = (v) => (Number.isFinite(v) ? numberFmt.format(v) : DASH);
  const yesNo = (v) => (typeof v === 'boolean' ? (v ? m.common_yes() : m.common_no()) : DASH);

  const FRAMEWORK_LABELS = { arduino: 'Arduino', zephyr: 'Zephyr', 'esp-idf': 'ESP-IDF', other: 'Other' };
  const LANGUAGE_LABELS = { cpp: 'C++', c: 'C', rust: 'Rust' };
  const runtimeText = (f) =>
    [FRAMEWORK_LABELS[f.runtime?.framework] ?? f.runtime?.framework, LANGUAGE_LABELS[f.runtime?.language] ?? f.runtime?.language]
      .filter(Boolean)
      .join(' · ') || DASH;

  const LINEAGE_VERB = {
    fork: m.spec_lineage_fork_of(),
    reimplementation: m.spec_lineage_reimpl_of(),
    upstream: m.spec_lineage_upstream()
  };
  function lineageText(f) {
    if (!f.lineage) return DASH;
    const verb = LINEAGE_VERB[f.lineage.kind] ?? '';
    const up = f.lineage.upstreamFirmwareId;
    if (f.lineage.kind === 'upstream') return m.spec_lineage_upstream();
    const upName = up ? getFirmware(up)?.name ?? up : '';
    return [verb, upName].filter(Boolean).join(' ') || DASH;
  }

  const SCALAR_ROWS = [
    { label: m.fw_facet_type(), get: (f) => firmwareTypeLabel(f.type) },
    { label: m.spec_distribution(), get: (f) => firmwareDistributionLabel(f.distribution) || DASH },
    { label: m.spec_maintainer(), get: (f) => txt(f.maintainer) },
    { label: m.spec_based_on(), get: lineageText },
    { label: m.fw_facet_status(), get: (f) => firmwareStatusLabel(f.status) || DASH },
    { label: m.fw_facet_maturity(), get: (f) => firmwareMaturityLabel(f.maturity) || DASH },
    { label: m.spec_lifecycle(), get: (f) => firmwareLifecycleLabel(f.lifecycle) || DASH },
    { label: m.fw_facet_runtime(), get: runtimeText },
    { label: m.fw_facet_license(), get: (f) => txt(f.license) },
    { label: m.about_licensing_title(), get: (f) => txt(LICENSE_TYPE_META[licenseType(f)]?.label) },
    { label: m.spec_latest_version(), get: (f) => txt(f.latest_version) },
    { label: m.rel_col_released(), get: (f) => txt(f.released) },
    { label: m.spec_node_roles(), get: (f) => (f.roles ?? []).map(nodeRoleLabel).join(', ') || DASH },
    { label: m.collection_devices_label(), get: (f) => String(f.deviceCount) },
    { label: m.spec_github_stars(), get: (f) => num(f.popularity?.githubStars) },
    { label: m.spec_forks(), get: (f) => num(f.popularity?.githubForks) },
    { label: m.spec_watchers(), get: (f) => num(f.popularity?.githubWatchers) },
    { label: m.spec_open_issues(), get: (f) => num(f.popularity?.githubOpenIssues) },
    { label: m.home_contributors(), get: (f) => num(f.popularity?.githubContributors) },
    { label: m.spec_release_downloads(), get: (f) => num(f.popularity?.releaseDownloads) },
    { label: m.spec_latest_downloads(), get: (f) => num(f.popularity?.latestReleaseDownloads) },
    { label: m.spec_popularity_checked(), get: (f) => txt(f.popularity?.lastChecked) },
    { label: m.license_source_available(), get: (f) => yesNo(f.verification?.sourceAvailable) },
    { label: m.spec_releases_available(), get: (f) => yesNo(f.verification?.releasesAvailable) },
    { label: m.spec_signed_releases(), get: (f) => yesNo(f.verification?.signedReleases) },
    { label: m.spec_reproducible_builds(), get: (f) => yesNo(f.verification?.reproducibleBuilds) },
    { label: m.spec_ci_builds(), get: (f) => yesNo(f.verification?.ciBuilds) },
    { label: m.fw_tog_web_flasher(), get: (f) => yesNo(f.verification?.webFlasher) },
    { label: m.spec_documentation(), get: (f) => yesNo(f.verification?.hasDocumentation) },
    { label: m.spec_verification_checked(), get: (f) => txt(f.verification?.lastChecked) }
  ];

  let scalarRows = $derived(
    SCALAR_ROWS.map((r) => {
      const values = selected.map(r.get);
      return { label: r.label, values, differs: new Set(values).size > 1 };
    }).filter((r) => !onlyDiff || r.differs)
  );

  // Capability sections: per group, one row per documented item with a tri-state
  // value (true / false / undefined) for each firmware.
  const triKey = (v) => (v === true ? 'y' : v === false ? 'n' : 'u');
  let capSections = $derived(
    FIRMWARE_CAPABILITY_GROUPS.map((g) => {
      const items = g.items
        .map((k) => {
          const values = selected.map((f) => f.capabilities?.[g.key]?.[k]);
          return { label: firmwareCapabilityItemLabel(k), values, differs: new Set(values.map(triKey)).size > 1 };
        })
        // drop items no selected firmware documents, and (when filtering) equal rows
        .filter((it) => it.values.some((v) => v !== undefined) && (!onlyDiff || it.differs));
      return { key: g.key, label: firmwareCapabilityGroupLabel(g.key), items };
    }).filter((g) => g.items.length)
  );

  let hasAny = $derived(scalarRows.length || capSections.length);
</script>

<Seo title={m.tool_compare_firmwares_label()} description={m.compare_fw_seo_desc()} noindex />

<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
  <div>
    <PageHeader tool="compare-firmwares" subtitleClass="mb-0">
      {m.compare_selected({ items: pluralize(selected.length, 'firmware') })}
    </PageHeader>
  </div>
  <a class="text-[0.9rem] text-accent2 hover:underline" href={href('/firmwares/')}>{m.compare_add_firmwares()}</a>
</div>

{#if selected.length === 0}
  <p class="rounded-xl border border-edge bg-elev p-10 text-center text-dim">
    {@html m.compare_empty_firmwares({
      link: `<a class="text-accent2 hover:underline" href="${href('/firmwares/')}">${m.collection_firmwares_label()}</a>`
    })}
  </p>
{:else}
  <label class="mb-3 inline-flex cursor-pointer items-center gap-2 text-[0.85rem] text-dim select-none">
    <input type="checkbox" bind:checked={onlyDiff} class="accent-accent" />
    {m.compare_only_diff()}
  </label>

  <div class="overflow-x-auto rounded-xl border border-edge">
    <table class="w-full min-w-[600px] table-fixed border-collapse text-[0.88rem]">
      <thead>
        <tr>
          <th class="sticky left-0 z-10 w-40 min-w-40 border-b border-edge bg-elev p-3 text-left align-bottom"></th>
          {#each selected as f (f.id)}
            <th class="border-b border-l border-edge bg-elev p-3 text-left align-top">
              <div class="flex items-start justify-between gap-2">
                <a href={href(`/firmware/${f.id}/`)} class="group block">
                  <span class="mb-1.5 inline-block rounded-md px-2 py-0.5 text-[0.62rem] font-bold tracking-wide uppercase {TYPE_META[f.type]?.tw}">
                    {firmwareTypeLabel(f.type)}
                  </span>
                  <span class="block text-[0.95rem] font-semibold group-hover:text-accent">{f.name}</span>
                  {#if f.maintainer}<span class="block text-[0.78rem] font-normal text-dim">{f.maintainer}</span>{/if}
                </a>
                <Button
                  variant=""
                  size="none"
                  class="shrink-0 rounded p-1 text-dim hover:bg-elev2 hover:text-bad"
                  aria-label={m.aria_remove({ name: f.name })}
                  onclick={() => remove(f.id)}>✕</Button>
              </div>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each scalarRows as row (row.label)}
          <tr class={row.differs ? 'bg-accent/5' : ''}>
            <th class="sticky left-0 z-10 border-b border-edge bg-elev p-3 text-left text-[0.78rem] font-medium tracking-wide text-dim uppercase">
              {row.label}
            </th>
            {#each row.values as v}
              <td class="border-b border-l border-edge p-3 align-top {v === DASH ? 'text-dim' : ''}">{v}</td>
            {/each}
          </tr>
        {/each}

        {#each capSections as section (section.label)}
          <tr>
            <th
              colspan={selected.length + 1}
              class="sticky left-0 border-y border-edge bg-elev2 px-3 py-1.5 text-left text-[0.7rem] font-semibold tracking-wide text-dim uppercase"
            >
              {section.label}
            </th>
          </tr>
          {#each section.items as item (item.label)}
            <tr class={item.differs ? 'bg-accent/5' : ''}>
              <th class="sticky left-0 z-10 border-b border-edge bg-elev p-3 text-left text-[0.82rem] font-normal text-dim">
                {item.label}
              </th>
              {#each item.values as v}
                <td class="border-b border-l border-edge p-3 text-center align-top">
                  {#if v === true}
                    <span class="text-ok">✓</span>
                  {:else if v === false}
                    <span class="text-muted">✕</span>
                  {:else}
                    <span class="text-dim">—</span>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        {/each}
      </tbody>
    </table>
  </div>

  {#if !hasAny}
    <p class="mt-3 text-center text-[0.85rem] text-dim">{m.compare_fw_no_diff()}</p>
  {/if}
{/if}
