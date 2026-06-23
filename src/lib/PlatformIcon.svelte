<script>
  import Icon from '@iconify/svelte';
  import '$lib/platform-icons.js';
  import { platformMeta, platformIconifyId } from '$lib/platforms.js';

  let {
    platform,
    /** When true, show the platform label beside the icon. */
    showLabel = false,
    size = 14,
    class: className = ''
  } = $props();

  let meta = $derived(platformMeta(platform));
  let iconId = $derived(platformIconifyId(platform));
</script>

{#if iconId}
  <span
    class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap {className}"
    title={meta.label}
  >
    <Icon icon={iconId} width={size} height={size} aria-hidden="true" />
    {#if showLabel}<span class="text-[0.78rem]">{meta.label}</span>{/if}
  </span>
{:else if showLabel}
  <span class="inline-flex shrink-0 items-center whitespace-nowrap text-[0.78rem]" title={meta.label}>
    {meta.label}
  </span>
{:else}
  <span
    class="inline-flex shrink-0 items-center font-mono text-[0.6rem] text-dim"
    title={meta.label}
  >{platform}</span>
{/if}
