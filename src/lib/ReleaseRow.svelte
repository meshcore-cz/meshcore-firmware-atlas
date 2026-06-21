<script>
  import { base } from '$app/paths';
  import { displayVersion, fmtDateTime, relativeTime } from '$lib/format.js';
  // A single release-group row, shared by the homepage feed and /releases.
  let { release } = $props();
</script>

<a
  href="{base}/firmware/{release.firmware.id}/releases/#release-{release.version}"
  class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-edge px-1 py-2.5 hover:bg-elev/60"
>
  <span class="text-[0.9rem] font-medium text-accent2">{release.firmware.name}</span>
  <span class="font-mono text-[0.9rem] font-semibold">{displayVersion(release.version)}</span>
  {#if release.prerelease}
    <span class="rounded bg-warn/15 px-1.5 py-0.5 text-[0.6rem] font-bold tracking-wide text-warn uppercase">Pre</span>
  {/if}
  {#if release.variants.length > 1}
    <span class="text-[0.75rem] text-dim">{release.variants.length} variants</span>
  {/if}
  <span class="ml-auto text-[0.78rem] text-dim">
    <span>{relativeTime(release.datetime)}</span>
    <span class="text-muted">·</span>
    <span class="font-mono">{fmtDateTime(release.datetime)}</span>
  </span>
</a>
