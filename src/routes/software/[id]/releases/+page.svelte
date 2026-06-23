<script>
  import { base } from '$app/paths';
  import BackLink from '$lib/BackLink.svelte';
  import ReleaseGroupList from '$lib/ReleaseGroupList.svelte';
  import Seo from '$lib/Seo.svelte';
  let { data } = $props();
  let s = $derived(data.software);
</script>

<Seo title={`${s.name} releases`} description={`Full release history for ${s.name}, MeshCore software.`} />

<BackLink href="{base}/software/{s.id}/">{s.name}</BackLink>

<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-edge pb-1.5">
  <h1 class="text-[clamp(1.4rem,5vw,1.9rem)] font-bold">{s.name} · Releases</h1>
  {#if s.changelogUpdatedAt}
    <span class="text-[0.72rem] text-dim">
      {s.changelogSource === 'github' ? 'from GitHub · ' : ''}updated {s.changelogUpdatedAt.slice(0, 10)}
    </span>
  {/if}
</div>

<p class="mb-4 text-[0.85rem] text-dim">{data.groups.length} releases</p>

<ReleaseGroupList groups={data.groups} openFirst={false} />
