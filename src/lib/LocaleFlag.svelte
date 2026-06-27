<script>
  import { base } from '$app/paths';
  import { countryFlagSvg } from '$lib/data.js';

  /** @type {{ flag?: string | null, flagUrl?: string | null, class?: string }} */
  let {
    flag = null,
    flagUrl = null,
    class: className = 'inline-flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-edge/70 [&>svg]:h-full [&>svg]:w-full [&>svg]:object-cover [&>img]:h-full [&>img]:w-full [&>img]:object-cover'
  } = $props();

  const svg = $derived(flagUrl ? null : countryFlagSvg(flag));
  const imgSrc = $derived(flagUrl ? `${base}${flagUrl}` : null);
</script>

{#if svg || imgSrc}
  <span class={className}>
    {#if imgSrc}
      <img src={imgSrc} alt="" width="20" height="14" />
    {:else}
      {@html svg}
    {/if}
  </span>
{/if}
