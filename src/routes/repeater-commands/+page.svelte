<script>
  import Seo from '$lib/Seo.svelte';
  import PageHeader from '$lib/PageHeader.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import {
    COMMAND_GROUPS,
    COMMAND_FLAGS,
    CURRENT_META,
    CURRENT_VERSION,
    SOURCE_FILES,
    sourceRef,
    firmwareSourceUrl,
    availableIn,
    deprecatedIn,
    cmpVersion,
    loadHistory
  } from '$lib/repeaterCommands.js';
  import { localizeRepeaterCommandsCatalog } from '$lib/catalog-overlay.js';
  import { getLocale } from '$lib/paraglide/runtime.js';

  let selectedVersion = $state(CURRENT_VERSION);
  let query = $state('');

  // History (full version list + changelogs) is loaded on demand so the default
  // view ships only the current release. Until it arrives, expose just the
  // current release so the selector and source links still work.
  let versions = $state([CURRENT_META]);
  let changelog = $state({ [CURRENT_VERSION]: {} });
  $effect(() => {
    loadHistory().then((h) => {
      versions = h.VERSIONS;
      changelog = h.CHANGELOG;
    });
  });

  let active = $derived(versions.find((v) => v.version === selectedVersion) ?? CURRENT_META);
  let isCurrent = $derived(selectedVersion === CURRENT_VERSION);
  // Fall back to a "no changes" note for releases that didn't touch the CLI.
  let changes = $derived(
    changelog[selectedVersion] ?? {
      note: m.rc_no_cli_changes()
    }
  );

  function commandText(c) {
    if (c.cmd) return `${c.cmd} ${c.args ?? ''}`;
    const parts = [];
    if (c.get) parts.push(`get ${c.name}`);
    if (c.set) parts.push(`set ${c.name} ${typeof c.set === 'string' ? c.set : ''}`);
    return parts.join(' ');
  }

  let commandCatalog = $derived(
    localizeRepeaterCommandsCatalog(COMMAND_GROUPS, COMMAND_FLAGS, getLocale())
  );
  let commandGroups = $derived(commandCatalog.groups);
  let commandFlags = $derived(commandCatalog.flags);

  // Filter by version first, then by the search query; drop empty groups.
  let filteredGroups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return commandGroups.map((g) => ({
      ...g,
      commands: g.commands.filter(
        (c) =>
          availableIn(c, selectedVersion) &&
          (!q ||
            commandText(c).toLowerCase().includes(q) ||
            (c.desc ?? '').toLowerCase().includes(q) ||
            (c.name ?? '').toLowerCase().includes(q))
      )
    })).filter((g) => g.commands.length > 0);
  });

  let totalCount = $derived(
    commandGroups.reduce(
      (n, g) => n + g.commands.filter((c) => availableIn(c, selectedVersion)).length,
      0
    )
  );
  let shownCount = $derived(filteredGroups.reduce((n, g) => n + g.commands.length, 0));

  // Tailwind can't see classes built at runtime, so map tones to fixed strings.
  const toneClass = {
    amber: 'border-amber-500/40 bg-amber-500/10 text-amber-500',
    sky: 'border-sky-500/40 bg-sky-500/10 text-sky-500',
    rose: 'border-rose-500/40 bg-rose-500/10 text-rose-500',
    violet: 'border-violet-500/40 bg-violet-500/10 text-violet-500',
    green: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500',
    zinc: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400'
  };

  let copied = $state(null);
  let copyTimer;
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      copied = text;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = null), 1200);
    } catch (e) {
      // clipboard unavailable (insecure context, denied) — ignore
    }
  }

  // Inline markup for the footer prose rendered with {@html}; only our own
  // trusted markup is injected.
  let generatedVars = $derived({
    ref: `<code class="rounded bg-elev2 px-1.5 py-0.5 font-mono">${sourceRef(selectedVersion)}</code>`
  });
  let seeAlsoVars = $derived({
    cliRef: `<a class="text-accent2 hover:underline" href="https://docs.meshcore.io/cli_commands/" target="_blank" rel="noreferrer">${m.rc_cli_reference()}</a>`
  });
</script>

<Seo title={m.tool_repeater_commands_label()} description={m.rc_seo_desc()} />

<PageHeader title={m.tool_repeater_commands_label()} tool="about" subtitleClass="max-w-2xl">
  {@html m.rc_intro()}
</PageHeader>

<!-- Controls: version + search -->
<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
  <label class="flex items-center gap-2 text-[0.85rem] text-dim">
    <span class="shrink-0">{m.rc_firmware_label()}</span>
    <select
      bind:value={selectedVersion}
      class="rounded-md border border-edge bg-bg px-2.5 py-1.5 text-[0.9rem] text-ink hover:border-accent focus:border-accent focus:outline-none"
    >
      {#each versions as v}
        <option value={v.version}>
          {v.label}{v.current ? ` · ${m.rc_current()}` : ''}{v.date ? `  (${v.date})` : ''}
        </option>
      {/each}
    </select>
  </label>

  <div class="relative flex-1">
    <svg
      class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" stroke-linecap="round" />
    </svg>
    <input
      type="search"
      bind:value={query}
      placeholder={m.rc_filter_placeholder()}
      class="w-full rounded-md border border-edge bg-bg py-1.5 pl-9 pr-3 text-[0.9rem] text-ink placeholder:text-muted hover:border-accent focus:border-accent focus:outline-none"
    />
  </div>

  <span class="shrink-0 text-[0.8rem] tabular-nums text-dim">
    {shownCount === totalCount ? m.rc_count({ count: totalCount }) : `${shownCount} / ${totalCount}`}
  </span>
</div>

<!-- What changed in the selected version -->
{#if changes.added || changes.deprecated || changes.note}
  <div class="mb-5 rounded-xl border border-edge bg-elev p-4">
    <h2 class="mb-2 text-[0.9rem] font-semibold">
      {isCurrent ? m.rc_new_in_version({ version: active.label }) : m.rc_changes_in_version({ version: active.label })}
    </h2>
    <div class="space-y-2">
      {#if changes.added}
        <div class="flex flex-wrap items-start gap-2">
          <span class="mt-0.5 rounded border px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide {toneClass.green}">
            {m.rc_added()}
          </span>
          <ul class="flex flex-1 flex-wrap gap-x-3 gap-y-1 text-[0.85rem] text-dim">
            {#each changes.added as item}
              <li class="font-mono text-[0.8rem]">{item}</li>
            {/each}
          </ul>
        </div>
      {/if}
      {#if changes.deprecated}
        <div class="flex flex-wrap items-start gap-2">
          <span class="mt-0.5 rounded border px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide {toneClass.zinc}">
            {m.rc_deprecated()}
          </span>
          <ul class="flex flex-1 flex-wrap gap-x-3 gap-y-1 text-[0.85rem] text-dim">
            {#each changes.deprecated as item}
              <li class="font-mono text-[0.8rem]">{item}</li>
            {/each}
          </ul>
        </div>
      {/if}
      {#if changes.note}
        <p class="text-[0.85rem] text-dim">{changes.note}</p>
      {/if}
    </div>
  </div>
{/if}

<!-- Legend -->
<div class="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.78rem] text-dim">
  {#each Object.entries(commandFlags) as [key, f]}
    <span class="flex items-center gap-1.5">
      <span class="rounded border px-1.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide {toneClass[f.tone]}">
        {f.label}
      </span>
      <span>{f.desc}</span>
    </span>
  {/each}
</div>

{#if filteredGroups.length === 0}
  <p class="rounded-xl border border-edge bg-elev p-6 text-center text-dim">
    {m.rc_no_match({ query, version: active.label })}
  </p>
{:else}
  <div class="grid gap-4 sm:grid-cols-2">
    {#each filteredGroups as group (group.id)}
      <section class="overflow-hidden rounded-xl border border-edge bg-elev">
        <header class="border-b border-edge bg-elev2 px-4 py-2.5">
          <h2 class="text-[0.95rem] font-semibold">{group.label}</h2>
          {#if group.blurb}
            <p class="mt-1 text-[0.78rem] leading-snug text-dim">{group.blurb}</p>
          {/if}
        </header>
        <ul class="divide-y divide-edge">
          {#each group.commands as c}
            {@const forms = c.cmd
              ? [`${c.cmd}${c.args ? ' ' + c.args : ''}`]
              : [
                  ...(c.get ? [`get ${c.name}`] : []),
                  ...(c.set ? [`set ${c.name}${typeof c.set === 'string' ? ' ' + c.set : ''}`] : [])
                ]}
            {@const isNew = c.addedIn === selectedVersion}
            {@const isDeprecated = deprecatedIn(c, selectedVersion)}
            <li class="px-4 py-3">
              <div class="flex flex-wrap items-center gap-1.5">
                {#each forms as form}
                  <button
                    type="button"
                    onclick={() => copy(form)}
                    title={m.rc_click_to_copy()}
                    class="group inline-flex items-center gap-1.5 rounded-md border border-edge bg-bg px-2 py-1 font-mono text-[0.82rem] text-ink transition hover:border-accent hover:text-accent {isDeprecated ? 'line-through decoration-zinc-500/60' : ''}"
                  >
                    <span>{form}</span>
                    {#if copied === form}
                      <span class="text-[0.7rem] text-accent2">{m.rc_copied()}</span>
                    {:else}
                      <svg
                        class="h-3.5 w-3.5 text-dim opacity-0 transition group-hover:opacity-100"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        aria-hidden="true"
                      >
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke-linecap="round" />
                      </svg>
                    {/if}
                  </button>
                {/each}
                {#if isNew}
                  <span class="rounded border px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide {toneClass.green}">{m.rc_new()}</span>
                {/if}
                {#if isDeprecated}
                  <span class="rounded border px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide {toneClass.zinc}">{m.rc_deprecated()}</span>
                {/if}
                {#each c.flags ?? [] as flag}
                  {@const f = commandFlags[flag]}
                  {#if f}
                    <span
                      title={f.desc}
                      class="rounded border px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide {toneClass[f.tone]}"
                    >
                      {f.label}
                    </span>
                  {/if}
                {/each}
              </div>
              <p class="mt-1.5 text-[0.85rem] leading-snug text-dim">{c.desc}</p>
              {#if c.range}
                <p class="mt-1 font-mono text-[0.74rem] text-muted">{c.range}</p>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}

<div class="mt-8 space-y-2 text-[0.8rem] text-dim">
  <p>{@html m.rc_generated(generatedVars)}</p>
  <p class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
    <span class="text-muted">{m.rc_source_files()}</span>
    {#each SOURCE_FILES as src}
      <a
        class="inline-flex items-center gap-1 text-accent2 hover:underline"
        href={firmwareSourceUrl(src.path, sourceRef(selectedVersion))}
        target="_blank"
        rel="noreferrer"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.78 1.2 1.78 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.67 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17a10.9 10.9 0 0 1 5.74 0c2.18-1.48 3.14-1.17 3.14-1.17.63 1.58.24 2.75.12 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.37-5.25 5.66.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5Z" />
        </svg>
        {src.label}
      </a>
    {/each}
  </p>
  <p>{@html m.rc_see_also(seeAlsoVars)}</p>
</div>
