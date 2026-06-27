<script>
  import { href } from '$lib/i18n.js';
  import { collectionById, collectionLabel } from '$lib/collections.js';

  /** @type {{ id: import('$lib/collections.js').CollectionId }} */
  let { id } = $props();

  const collection = $derived(collectionById(id));
  const label = $derived(collectionLabel(id));
  const Icon = $derived(collection?.icon);
</script>

{#if collection}
  <a
    class="inline-flex items-center gap-2 rounded-lg border border-edge bg-elev px-3.5 py-2 text-[0.9rem] text-dim transition hover:border-accent hover:text-ink"
    href={href(collection.href)}
  >
    {#if Icon}
      <Icon class="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
    {/if}
    {label}
  </a>
{/if}
