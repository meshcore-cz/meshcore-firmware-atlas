<script>
  import { onMount, onDestroy } from 'svelte';
  import { href } from '$lib/i18n.js';
  import { m } from '$lib/paraglide/messages.js';
  import { API_BASE, LIVE_ENABLED, poll, fmtRate, agoLabel } from '$lib/pulse.js';
  import Seo from '$lib/Seo.svelte';
  import PageHeader from '$lib/PageHeader.svelte';

  // Reachability + health. `online`: null = checking, true = up, false = down.
  // We don't reuse poll() for health because it swallows failures, and this page
  // is specifically about whether the API is reachable.
  let online = $state(null);
  let health = $state(null);
  let checkedAt = $state(0);
  let nets = $state([]);

  onMount(() => {
    if (!LIVE_ENABLED) return;
    let stopped = false;
    let timer;
    async function tick() {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (stopped) return;
        if (res.ok) {
          health = await res.json();
          online = true;
        } else {
          online = false;
        }
      } catch {
        if (!stopped) online = false;
      }
      checkedAt = Date.now();
      if (!stopped) timer = setTimeout(tick, 5000);
    }
    tick();
    const stopNets = poll('/api/networks', 5000, (res) => {
      nets = [...(res.networks ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      stopNets();
    };
  });

  // Expandable per-network analyzer breakdown. Only one network is expanded at a
  // time; while open we poll its detail endpoint so the analyzer states stay live.
  let expandedId = $state(null);
  let detail = $state(null);
  let stopDetail = null;
  function toggle(id) {
    if (stopDetail) {
      stopDetail();
      stopDetail = null;
    }
    if (expandedId === id) {
      expandedId = null;
      detail = null;
      return;
    }
    expandedId = id;
    detail = null;
    stopDetail = poll(`/api/networks/${id}`, 5000, (d) => {
      if (expandedId === id) detail = d;
    });
  }
  onDestroy(() => stopDetail?.());

  // Clicking a row toggles its analyzers, but let real links and text selection
  // behave normally.
  function rowClick(event, id) {
    if (event.target.closest('a, button')) return;
    if (window.getSelection()?.toString()) return;
    toggle(id);
  }

  const STATE = {
    null: { label: m.status_state_checking(), dot: 'bg-dim', text: 'text-dim' },
    true: { label: m.status_state_operational(), dot: 'bg-accent', text: 'text-accent' },
    false: { label: m.status_state_unreachable(), dot: 'bg-red-400', text: 'text-red-400' }
  };
  let s = $derived(STATE[String(online)]);
</script>

<Seo title={m.tool_status_label()} description={m.status_seo_desc()} />

<PageHeader tool="status" subtitleClass="mb-5 max-w-2xl">
  {m.status_intro()}
</PageHeader>

{#if !LIVE_ENABLED}
  <div class="rounded-xl border border-edge bg-elev p-5">
    <div class="mb-1 flex items-center gap-2 font-semibold">
      <span class="h-2.5 w-2.5 rounded-full bg-dim"></span> {m.status_disabled_title()}
    </div>
    <p class="text-[0.9rem] text-dim">
      {@html m.status_disabled_body({
        code: '<code class="font-mono text-[0.85rem]">VITE_API_BASE</code>'
      })}
    </p>
  </div>
{:else}
  <!-- Overall health -->
  <div class="mb-6 rounded-xl border border-edge bg-elev p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <span class="h-3 w-3 rounded-full {s.dot} {online ? 'animate-pulse' : ''}"></span>
        <span class="text-[1.05rem] font-semibold {s.text}">{s.label}</span>
      </div>
      <span class="font-mono text-[0.8rem] text-dim">{API_BASE}</span>
    </div>

    <dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[0.92rem] sm:grid-cols-4">
      <div>
        <dt class="text-[0.78rem] uppercase tracking-wide text-dim">{m.status_analyzers()}</dt>
        <dd class="mt-0.5 font-semibold">
          {#if health}<span class={health.analyzersConnected ? 'text-accent' : 'text-red-400'}>{health.analyzersConnected}</span> / {health.analyzers}{:else}—{/if}
        </dd>
      </div>
      <div>
        <dt class="text-[0.78rem] uppercase tracking-wide text-dim">{m.collection_networks_label()}</dt>
        <dd class="mt-0.5 font-semibold">{health?.networks ?? '—'}</dd>
      </div>
      <div>
        <dt class="text-[0.78rem] uppercase tracking-wide text-dim">{m.status_server_time()}</dt>
        <dd class="mt-0.5 font-semibold">{health?.time ? agoLabel(health.time) ?? m.status_just_now() : '—'}</dd>
      </div>
      <div>
        <dt class="text-[0.78rem] uppercase tracking-wide text-dim">{m.status_last_checked()}</dt>
        <dd class="mt-0.5 font-semibold">{checkedAt ? agoLabel(Math.floor(checkedAt / 1000)) ?? m.status_just_now() : '—'}</dd>
      </div>
    </dl>
  </div>

  <!-- Per-network analyzer breakdown -->
  {#if nets.length}
    <div class="overflow-hidden rounded-xl border border-edge">
      <table class="w-full border-collapse text-[0.92rem]">
        <thead>
          <tr class="border-b border-edge bg-elev2 text-left text-[0.8rem] uppercase tracking-wide text-dim">
            <th class="px-4 py-2.5 font-semibold">{m.cmd_type_network()}</th>
            <th class="px-4 py-2.5 text-right font-semibold">{m.status_analyzers()}</th>
            <th class="px-4 py-2.5 text-right font-semibold">pkt/m</th>
            <th class="px-4 py-2.5 text-right font-semibold">{m.status_nodes()}</th>
            <th class="px-4 py-2.5 text-right font-semibold">{m.status_last_packet()}</th>
          </tr>
        </thead>
        <tbody>
          {#each nets as n (n.id)}
            <tr
              class="cursor-pointer border-b border-edge transition hover:bg-elev {expandedId === n.id ? 'bg-elev' : ''}"
              onclick={(e) => rowClick(e, n.id)}
              aria-expanded={expandedId === n.id}
            >
              <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5">
                  <span class="text-dim transition" style:transform={expandedId === n.id ? 'rotate(90deg)' : 'none'}>›</span>
                  <a class="font-medium text-accent2 hover:underline" href={href(`/network/${n.id}/`)}>{n.name}</a>
                </span>
              </td>
              <td class="px-4 py-3 text-right tabular-nums">
                <span class={n.analyzersConnected ? 'text-accent' : 'text-red-400'}>{n.analyzersConnected}</span>
                <span class="text-dim"> / {n.analyzersTotal}</span>
              </td>
              <td class="px-4 py-3 text-right tabular-nums">{fmtRate(n.pktPerMin) ?? '—'}</td>
              <td class="px-4 py-3 text-right tabular-nums">{n.nodes ?? '—'}</td>
              <td class="px-4 py-3 text-right text-dim">{agoLabel(n.lastPacketAt) ?? m.status_never()}</td>
            </tr>
            {#if expandedId === n.id}
              <tr class="border-b border-edge last:border-0 bg-elev2/40">
                <td colspan="5" class="px-4 py-3">
                  {#if detail?.analyzers?.length}
                    <ul class="flex flex-col gap-2">
                      {#each detail.analyzers as a (a.url)}
                        <li class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.85rem]">
                          <span class="h-2 w-2 shrink-0 rounded-full {a.connected ? 'bg-accent' : 'bg-red-400'}"></span>
                          <a class="font-medium text-accent2 hover:underline" href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>
                          <span class="text-dim">{a.connected ? m.status_connected({ ago: agoLabel(a.connectedSince) ?? '' }).trim() : m.status_disconnected()}</span>
                          <span class="ml-auto tabular-nums text-dim">
                            {m.status_analyzer_meta({ rate: fmtRate(a.pktPerMin) ?? '—', nodes: a.nodes ?? 0, ago: agoLabel(a.lastPacketAt) ?? m.status_never() })}
                          </span>
                        </li>
                      {/each}
                    </ul>
                  {:else}
                    <span class="text-[0.85rem] text-dim">{m.status_loading()}</span>
                  {/if}
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {:else if online}
    <p class="text-[0.9rem] text-dim">{m.status_no_data()}</p>
  {/if}
{/if}
