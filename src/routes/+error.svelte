<script>
  // Shown for any load error — most commonly a 404 (also the GitHub-Pages
  // `404.html` SPA fallback, see svelte.config.js). Renders inside the root
  // layout, so the header, footer and locale switcher stay in place. Copy is
  // status-aware and fully localized.
  import { page } from '$app/stores';
  import { href } from '$lib/i18n.js';
  import { m } from '$lib/paraglide/messages.js';
  import { searchOpen } from '$lib/search.js';
  import Seo from '$lib/Seo.svelte';
  import Button from '$lib/Button.svelte';

  let status = $derived($page.status);
  let isNotFound = $derived(status === 404);
  let title = $derived(isNotFound ? m.error_404_title() : m.error_generic_title());
  let body = $derived(isNotFound ? m.error_404_body() : m.error_generic_body());
</script>

<Seo {title} noindex />

<div class="flex flex-col items-center justify-center py-[clamp(2rem,10vw,5rem)] text-center">
  <p class="font-bold leading-none text-accent/25 tabular-nums text-[clamp(4rem,18vw,8rem)]">
    {status}
  </p>
  <h1 class="mt-3 text-[clamp(1.5rem,5vw,2rem)] font-bold">{title}</h1>
  <p class="mt-3 max-w-md text-dim">{body}</p>
  <div class="mt-7 flex flex-wrap items-center justify-center gap-2.5">
    <Button href={href('/')} variant="primary" size="lg">{m.error_home_button()}</Button>
    <Button variant="outline" size="lg" onclick={() => ($searchOpen = true)}>
      {m.error_search_button()}
    </Button>
  </div>
</div>
