<script>
  import {
    FIRMWARE_CAPABILITY_GROUPS,
    firmwareCapabilityGroupLabel,
    firmwareCapabilityItemLabel
  } from '$lib/data.js';

  let { capabilities = {} } = $props();

  // Keep only groups that have at least one documented (non-undefined) value,
  // and within each group only the documented items — so sparsely-filled
  // firmwares don't render rows of "unknown".
  let groups = $derived(
    FIRMWARE_CAPABILITY_GROUPS.map((g) => {
      const section = capabilities?.[g.key] ?? {};
      const items = g.items
        .filter((k) => section[k] !== undefined)
        .map((k) => ({ key: k, label: firmwareCapabilityItemLabel(k), on: section[k] === true }));
      return { key: g.key, label: firmwareCapabilityGroupLabel(g.key), items };
    }).filter((g) => g.items.length)
  );
</script>

{#if groups.length}
  <div class="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
    {#each groups as g (g.key)}
      <div class="rounded-xl border border-edge bg-elev p-3.5">
        <h3 class="mb-2 text-[0.72rem] font-semibold tracking-wide text-dim uppercase">{g.label}</h3>
        <ul class="flex flex-col gap-1.5">
          {#each g.items as item (item.key)}
            <li class="flex items-center gap-2 text-[0.88rem] {item.on ? '' : 'text-dim'}">
              {#if item.on}
                <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ok/15 text-[0.7rem] text-ok">✓</span>
              {:else}
                <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-elev2 text-[0.7rem] text-muted">✕</span>
              {/if}
              <span>{item.label}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>
{/if}
