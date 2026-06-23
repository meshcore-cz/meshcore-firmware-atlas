<script>
  // Standard page heading: an <h1> plus an optional dim subtitle paragraph.
  // The subtitle is a snippet so callers can embed inline links; pass
  // `subtitleClass` for per-page tweaks like a max-width.
  //
  // Pass `collection` or `tool` to pull the label and icon from the site
  // registries, or set `title` / `icon` explicitly.
  import { collectionById } from '$lib/collections.js';
  import { toolById } from '$lib/tools.js';

  let { title, collection = null, tool = null, icon = null, subtitleClass = '', children } =
    $props();

  const meta = $derived(
    collection ? collectionById(collection) : tool ? toolById(tool) : null
  );
  const Icon = $derived(icon ?? meta?.icon ?? null);
  const displayTitle = $derived(title ?? meta?.label ?? '');
</script>

<h1 class="mb-1 flex items-center gap-2.5 text-[clamp(1.5rem,5vw,2rem)] font-bold">
  {#if Icon}
    <Icon class="h-[0.9em] w-[0.9em] shrink-0 text-accent" aria-hidden="true" />
  {/if}
  <span>{displayTitle}</span>
</h1>
{#if children}
  <p class="mb-5 text-dim {subtitleClass}">{@render children()}</p>
{/if}
