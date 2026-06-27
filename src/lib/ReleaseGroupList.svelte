<script>
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { displayVersion, fmtDateTime, relativeTime } from '$lib/format.js';
  // A list of grouped releases (variants collapsed), with rendered Markdown
  // notes. Shared by the firmware detail page and /firmware/<id>/releases.
  let { groups, openFirst = true, markFirstLatest = false } = $props();

  // Per-release deep links: each card has id="release-<version>". Loading with
  // (or navigating to) such a hash opens that release and scrolls it into view.
  const releaseId = (version) => `release-${version}`;

  function openFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id.startsWith('release-')) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector('details')?.setAttribute('open', '');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Clicking the permalink updates the URL (shareable) without letting the
  // <summary> toggle the card; the hashchange listener does the open + scroll.
  function linkRelease(version, e) {
    e.preventDefault();
    e.stopPropagation();
    const id = releaseId(version);
    if (location.hash.slice(1) === id) openFromHash();
    else location.hash = id;
  }

  onMount(() => {
    openFromHash();
    addEventListener('hashchange', openFromHash);
    return () => removeEventListener('hashchange', openFromHash);
  });

  // Tailwind utilities applied to descendants of the rendered Markdown notes.
  const prose =
    'border-t border-edge px-3.5 py-3 text-[0.85rem] leading-relaxed text-dim ' +
    '[&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:text-[1rem] [&_h1]:font-semibold [&_h1]:text-ink ' +
    '[&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-[0.95rem] [&_h2]:font-semibold [&_h2]:text-ink ' +
    '[&_h3]:mt-2 [&_h3]:mb-0.5 [&_h3]:font-semibold [&_h3]:text-ink ' +
    '[&_p]:my-1.5 [&_a]:text-accent2 [&_a:hover]:underline [&_strong]:text-ink ' +
    '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 ' +
    '[&_code]:rounded [&_code]:bg-elev2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] ' +
    '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-elev2 [&_pre]:p-2.5 [&_pre_code]:bg-transparent [&_pre_code]:p-0 ' +
    '[&_table]:my-2 [&_table]:block [&_table]:w-max [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-[0.8rem] ' +
    '[&_th]:border [&_th]:border-edge [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-ink [&_td]:border [&_td]:border-edge [&_td]:px-2 [&_td]:py-1 ' +
    '[&_img]:my-1 [&_img]:inline-block [&_img]:max-w-full [&_blockquote]:border-l-2 [&_blockquote]:border-edge [&_blockquote]:pl-3 [&_blockquote]:italic [&_hr]:my-3 [&_hr]:border-edge';
</script>

<ol class="flex flex-col gap-2">
  {#each groups as g, i}
    {@const single = g.variants.length === 1}
    {@const latest = markFirstLatest && i === 0}
    <li id={releaseId(g.version)} class="scroll-mt-20 rounded-lg border bg-elev {latest ? 'border-accent/70 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]' : 'border-edge'}">
      <details open={openFirst && i === 0}>
        <summary class="group flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 marker:content-none">
          <span class="font-mono text-[1rem] font-semibold">{displayVersion(g.version)}</span>
          <a
            href="#{releaseId(g.version)}"
            onclick={(e) => linkRelease(g.version, e)}
            class="-ml-1.5 text-[0.95rem] text-dim opacity-0 transition group-hover:opacity-100 hover:text-accent focus:opacity-100"
            title="Permalink to this release"
            aria-label="Permalink to {displayVersion(g.version)}"
          >#</a>
          {#if latest}<span class="rounded bg-accent/15 px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide text-accent uppercase">{m.rel_latest()}</span>{/if}
          {#if g.prerelease}<span class="rounded bg-warn/15 px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide text-warn uppercase">Pre-release</span>{/if}
          {#if !single}<span class="text-[0.78rem] text-dim">{g.variants.length} variants</span>{/if}
          {#if g.datetime}
            <span class="ml-auto text-[0.78rem] text-dim">
              <span>{relativeTime(g.datetime)}</span>
              <span class="text-muted">·</span>
              <span class="font-mono">{fmtDateTime(g.datetime)}</span>
            </span>
          {/if}
        </summary>

        {#if single}
          {#if g.variants[0].url}
            <div class="border-t border-edge px-3.5 py-2">
              <a class="text-[0.82rem] text-accent2 hover:underline" href={g.variants[0].url} target="_blank" rel="noreferrer">View release ↗</a>
            </div>
          {/if}
        {:else}
          <div class="flex flex-col divide-y divide-edge border-t border-edge">
            {#each g.variants as v}
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2 text-[0.82rem]">
                <span class="font-medium capitalize">{(v.variant ?? '').replace(/-/g, ' ') || v.version}</span>
                <span class="font-mono text-dim">{v.version}</span>
                {#if v.prerelease}<span class="rounded bg-warn/15 px-1.5 py-0.5 text-[0.6rem] font-bold tracking-wide text-warn uppercase">Pre</span>{/if}
                {#if v.url}<a class="ml-auto text-accent2 hover:underline" href={v.url} target="_blank" rel="noreferrer">View ↗</a>{/if}
              </div>
            {/each}
          </div>
        {/if}

        {#if g.notesHtml}
          <div class={prose}>{@html g.notesHtml}</div>
        {:else if g.notes}
          <pre class="overflow-x-auto border-t border-edge px-3.5 py-2.5 text-[0.82rem] whitespace-pre-wrap text-dim">{g.notes}</pre>
        {/if}
      </details>
    </li>
  {/each}
</ol>
