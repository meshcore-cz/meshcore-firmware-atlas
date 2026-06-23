<script>
  import { base } from '$app/paths';
  import { pluralize } from '$lib/format.js';
  import { deviceMcuLabel, deviceRadioLabel, deviceShortName } from '$lib/data.js';
  import Seo from '$lib/Seo.svelte';
  import Avatar from '$lib/Avatar.svelte';
  import PageHeader from '$lib/PageHeader.svelte';
  let { data } = $props();
</script>

<Seo
  title="Vendors"
  description={`${data.vendors.length} hardware makers whose boards run MeshCore firmware.`}
/>

<PageHeader collection="vendors" subtitleClass="max-w-[60ch]">
  Hardware makers whose boards run MeshCore firmware — every vendor and the boards they make, most
  prolific first.
</PageHeader>

<div class="space-y-12">
  {#each data.vendors as v (v.id)}
    <section>
      <!-- Vendor header -->
      <div class="mb-4 flex items-center gap-4 border-b border-edge pb-4">
        <a href="{base}/vendor/{v.id}/" class="shrink-0">
          <Avatar
            src={v.logoUrl}
            alt={v.name}
            class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white p-2"
            imgClass="max-h-full max-w-full object-contain"
          >
            <svg class="h-8 w-8 text-slate-400" viewBox="0 0 32 32" aria-hidden="true">
              <rect x="9" y="9" width="14" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2.2" />
              <path d="M12 5v4M20 5v4M12 23v4M20 23v4M5 12h4M5 20h4M23 12h4M23 20h4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.2" />
              <circle cx="16" cy="16" r="2.8" fill="currentColor" opacity="0.45" />
            </svg>
          </Avatar>
        </a>
        <div class="min-w-0 flex-1">
          <h2 class="text-[1.3rem] leading-tight font-bold">
            <a class="hover:text-accent" href="{base}/vendor/{v.id}/">{v.name}</a>
          </h2>
          <span class="text-[0.88rem] text-dim">
            {v.country ? `${v.country} · ` : ''}{pluralize(v.devices.length, 'device')}
          </span>
        </div>
        <a class="shrink-0 text-[0.85rem] text-accent2 hover:underline" href="{base}/vendor/{v.id}/">View vendor →</a>
      </div>

      <!-- Vendor's products -->
      {#if v.devices.length}
        <div class="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
          {#each v.devices as d (d.id)}
            <a
              class="group flex items-center gap-3 rounded-xl border border-edge bg-elev px-3.5 py-2.5 hover:border-accent"
              href="{base}/device/{d.id}/"
            >
              <div class="flex h-[46px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-elev2">
                {#if d.imageUrl}<img src={d.imageUrl} alt={d.name} loading="lazy" class="max-h-full max-w-full object-contain" />{/if}
              </div>
              <div class="min-w-0">
                <span class="block truncate text-[0.9rem] group-hover:text-accent">{deviceShortName(d)}</span>
                <span class="block truncate font-mono text-[0.76rem] text-dim">{deviceMcuLabel(d)} · {deviceRadioLabel(d)}</span>
              </div>
            </a>
          {/each}
        </div>
      {:else}
        <p class="text-[0.9rem] text-dim">No devices recorded yet.</p>
      {/if}
    </section>
  {/each}
</div>
