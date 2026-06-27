<script>
  // Floating "N selected → Compare" bar shown while a comparison set is active.
  // Shared by the devices and firmwares listings; `href` is the fully-built
  // compare URL and `onclear` empties the set.
  import Button from '$lib/Button.svelte';
  import { m } from '$lib/paraglide/messages.js';
  let { count = 0, href, onclear, label = m.compare_bar_compare() } = $props();
</script>

{#if count}
  <div class="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
    <div class="pointer-events-auto flex items-center gap-3 rounded-full border border-edge bg-elev2 py-2 pr-2 pl-4 shadow-2xl">
      <span class="text-[0.85rem] text-dim">
        <span class="font-semibold text-ink">{count}</span> {m.compare_bar_selected()}
      </span>
      <Button variant="" size="none" class="text-[0.85rem] text-dim hover:text-ink" onclick={onclear}>{m.compare_bar_clear()}</Button>
      <a class="rounded-full bg-accent px-4 py-1.5 text-[0.85rem] font-semibold text-bg hover:opacity-90" {href}>
        {label} →
      </a>
    </div>
  </div>
{/if}
