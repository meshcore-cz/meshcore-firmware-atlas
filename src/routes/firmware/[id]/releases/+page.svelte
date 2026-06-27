<script>
  import { href } from '$lib/i18n.js';
  import { m } from '$lib/paraglide/messages.js';
  import BackLink from '$lib/BackLink.svelte';
  import ReleaseGroupList from '$lib/ReleaseGroupList.svelte';
  import Seo from '$lib/Seo.svelte';
  let { data } = $props();
  let fw = $derived(data.firmware);
</script>

<Seo
  title={m.detail_releases_seo_title({ name: fw.name })}
  description={m.detail_releases_fw_seo_desc({ name: fw.name })}
/>

<BackLink href={href(`/firmware/${fw.id}/`)}>{fw.name}</BackLink>

<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-edge pb-1.5">
  <h1 class="text-[clamp(1.4rem,5vw,1.9rem)] font-bold">{m.detail_releases_title({ name: fw.name })}</h1>
  {#if fw.changelogUpdatedAt}
    <span class="text-[0.72rem] text-dim">
      {fw.changelogSource === 'github' ? m.detail_from_github() : ''}{m.detail_updated({ date: fw.changelogUpdatedAt.slice(0, 10) })}
    </span>
  {/if}
</div>

<p class="mb-4 text-[0.85rem] text-dim">{m.detail_releases_count({ count: data.groups.length })}</p>

<ReleaseGroupList groups={data.groups} openFirst={false} />
