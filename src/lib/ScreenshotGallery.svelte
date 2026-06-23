<script>
  // A compact thumbnail grid that opens a full-size lightbox on click, with
  // prev/next + keyboard navigation. `shots` is [{ url, caption?, file }].
  let { shots = [], alt = '' } = $props();

  let open = $state(false);
  let index = $state(0);

  let current = $derived(shots[index]);

  function show(i) {
    index = i;
    open = true;
  }
  function close() {
    open = false;
  }
  function step(delta) {
    index = (index + delta + shots.length) % shots.length;
  }

  function onKey(e) {
    if (!open) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  }

  // Lock background scroll while the lightbox is open.
  $effect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => (document.body.style.overflow = '');
  });
</script>

<svelte:window onkeydown={onKey} />

<!-- Thumbnails share a fixed HEIGHT with auto width, so portrait (mobile) shots
     show full-height and narrow while landscape shots stay short and wide —
     neither gets cropped. Ultra-wide panoramas are capped and cover-cropped. -->
<div class="flex flex-wrap items-start gap-4">
  {#each shots as shot, i (shot.file)}
    <figure class="m-0 flex flex-col items-center">
      <button
        type="button"
        onclick={() => show(i)}
        aria-label="View screenshot{shot.caption ? `: ${shot.caption}` : ''}"
        class="group block overflow-hidden rounded-lg border border-edge bg-elev2 transition hover:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
      >
        <img
          src={shot.url}
          alt={shot.caption ?? alt}
          loading="lazy"
          class="h-48 w-auto max-w-[360px] object-cover transition group-hover:scale-[1.03]"
        />
      </button>
      {#if shot.caption}
        <figcaption class="mt-1.5 max-w-[220px] text-center text-[0.78rem] text-dim">{shot.caption}</figcaption>
      {/if}
    </figure>
  {/each}
</div>

{#if open && current}
  <div
    class="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-8"
    role="dialog"
    aria-modal="true"
    aria-label="Screenshot viewer"
  >
    <!-- Backdrop: a full-size button so clicking outside the image closes it
         (keeps interactive elements as real buttons for a11y). -->
    <button type="button" class="absolute inset-0 cursor-default bg-black/80 backdrop-blur-sm" aria-label="Close viewer" onclick={close}></button>

    <button
      type="button"
      onclick={close}
      aria-label="Close"
      class="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-lg text-white/80 transition hover:bg-black/70 hover:text-white"
    >✕</button>

    {#if shots.length > 1}
      <button
        type="button"
        onclick={() => step(-1)}
        aria-label="Previous screenshot"
        class="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-2xl text-white/80 transition hover:bg-black/70 hover:text-white sm:left-5"
      >‹</button>
      <button
        type="button"
        onclick={() => step(1)}
        aria-label="Next screenshot"
        class="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-2xl text-white/80 transition hover:bg-black/70 hover:text-white sm:right-5"
      >›</button>
    {/if}

    <figure class="relative z-10 m-0 flex w-full max-w-[92vw] flex-col items-center">
      <!-- w-full forces a real width so SVGs that only carry a viewBox (no
           intrinsic size) scale up to fill instead of rendering at their tiny
           default size; h-auto + the viewBox aspect keep proportions, and
           max-h caps tall/portrait shots. -->
      <img
        src={current.url}
        alt={current.caption ?? alt}
        class="h-auto max-h-[85vh] w-full rounded-lg border border-white/10 object-contain shadow-2xl"
      />
      <figcaption class="mt-3 flex items-center gap-2 text-[0.85rem] text-white/80">
        {#if current.caption}<span>{current.caption}</span>{/if}
        {#if shots.length > 1}<span class="text-white/50">{index + 1} / {shots.length}</span>{/if}
      </figcaption>
    </figure>
  </div>
{/if}
