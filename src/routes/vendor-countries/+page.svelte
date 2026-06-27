<script>
  import { m } from '$lib/paraglide/messages.js';
  import { countryFlagSvg } from '$lib/data.js';
  import Seo from '$lib/Seo.svelte';
  import PageHeader from '$lib/PageHeader.svelte';
  let { data } = $props();

  let max = $derived(data.countries[0]?.vendors ?? 1);

  // Medal tint for the top three; everything else uses the neutral dim bar.
  const RANK_TONE = ['text-warn', 'text-dim', 'text-[#cd7f32]'];
</script>

<Seo
  title={m.tool_vendor_countries_label()}
  description={m.vendor_countries_seo_desc({ count: data.totalVendors })}
/>

<PageHeader tool="vendor-countries" subtitleClass="max-w-[70ch]">
  {m.vendor_countries_intro()}
</PageHeader>

{#if data.countries.length}
  <ol class="flex flex-col gap-1.5">
    {#each data.countries as c, i (c.country)}
      <li class="flex items-center gap-3 rounded-lg border border-edge bg-elev px-3 py-2.5">
        <span
          class="w-7 shrink-0 text-center font-mono text-[0.95rem] font-bold tabular-nums {RANK_TONE[i] ?? 'text-dim'}"
        >
          {i + 1}
        </span>
        <span class="flex w-40 shrink-0 items-center gap-2 min-w-0">
          {#if c.code && countryFlagSvg(c.code)}
            <span
              class="inline-flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-edge/70 [&>svg]:h-full [&>svg]:w-full [&>svg]:object-cover"
            >
              {@html countryFlagSvg(c.code)}
            </span>
          {:else}
            <span class="h-3.5 w-5 shrink-0" aria-hidden="true"></span>
          {/if}
          <span class="truncate font-medium text-ink">{c.country}</span>
        </span>
        <span class="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-elev2">
          <span
            class="absolute inset-y-0 left-0 rounded-full bg-accent"
            style="width: {(c.vendors / max) * 100}%"
          ></span>
        </span>
        <span class="w-10 shrink-0 text-right font-mono text-[0.9rem] font-semibold tabular-nums">
          {c.vendors}
        </span>
        <span class="w-20 shrink-0 text-right font-mono text-[0.78rem] text-dim tabular-nums">
          {m.count_device({ count: c.devices })}
        </span>
      </li>
    {/each}
  </ol>

  <p class="mt-4 text-[0.8rem] text-dim">
    {m.vendor_countries_summary({
      countries: data.countries.length,
      placed: data.placed,
      total: data.totalVendors
    })}
  </p>
{:else}
  <p class="text-dim">{m.vendor_countries_empty()}</p>
{/if}
