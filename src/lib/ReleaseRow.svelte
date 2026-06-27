<script>
  import { href } from '$lib/i18n.js';
  import { m } from '$lib/paraglide/messages.js';
  import { displayVersion, fmtDateTime, relativeTime, pluralize } from '$lib/format.js';
  // A single release-group row, shared by the homepage feed and /firmwares.
  // `release.project` carries the source firmware/software (name + releases-page
  // href). The mixed /releases page renders its own table instead.
  let { release } = $props();
  let project = $derived(release.project);
</script>

<a
  href="{href(project.href)}#release-{release.version}"
  class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-edge px-1 py-2.5 hover:bg-elev/60"
>
  <span class="text-[0.9rem] font-medium text-accent2">{project.name}</span>
  <span class="font-mono text-[0.9rem] font-semibold">{displayVersion(release.version)}</span>
  {#if release.prerelease}
    <span class="rounded bg-warn/15 px-1.5 py-0.5 text-[0.6rem] font-bold tracking-wide text-warn uppercase">{m.release_pre()}</span>
  {/if}
  {#if release.variants.length > 1}
    <span class="text-[0.75rem] text-dim">{pluralize(release.variants.length, 'variant')}</span>
  {/if}
  <span class="ml-auto text-[0.78rem] text-dim">
    <span>{relativeTime(release.datetime)}</span>
    <span class="text-muted">·</span>
    <span class="font-mono">{fmtDateTime(release.datetime)}</span>
  </span>
</a>
