<script>
  // Standard page heading: an <h1> plus an optional dim subtitle paragraph.
  // The subtitle is a snippet so callers can embed inline links; pass
  // `subtitleClass` for per-page tweaks like a max-width.
  //
  // Pass `collection` or `tool` to pull the label and icon from the site
  // registries, or set `title` / `icon` explicitly.
  import { collectionById, collectionLabel } from '$lib/collections.js';
  import { toolById, toolLabel } from '$lib/tools.js';

  let { title, collection = null, tool = null, icon = null, subtitleClass = '', children, actions } =
    $props();

  const meta = $derived(
    collection ? collectionById(collection) : tool ? toolById(tool) : null
  );
  const Icon = $derived(icon ?? meta?.icon ?? null);
  const localizedLabel = $derived(
    collection ? collectionLabel(collection) : tool ? toolLabel(tool) : null
  );
  const displayTitle = $derived(title ?? localizedLabel ?? meta?.label ?? '');
</script>

<div class="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
  <h1 class="flex min-w-0 items-center gap-2.5 text-[clamp(1.5rem,5vw,2rem)] font-bold">
    {#if Icon}
      <Icon class="h-[0.9em] w-[0.9em] shrink-0 text-accent" aria-hidden="true" />
    {/if}
    <span>{displayTitle}</span>
  </h1>
  {#if actions}
    <div class="flex flex-wrap gap-2">
      {@render actions()}
    </div>
  {/if}
</div>
{#if children}
  <p class="mb-5 text-dim {subtitleClass}">{@render children()}</p>
{/if}
