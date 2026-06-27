<script>
  // Friendly, dismissable banner that greets visitors in their own language when
  // the site supports it but they're viewing a different locale, linking to the
  // same page in their language. Greeting/CTA strings are authored *in the target
  // language* (so they read naturally to that visitor) and live in the central
  // locale registry, $lib/locales.js.
  //
  // Runs client-only: the target is resolved in onMount from navigator.languages,
  // so SSR and the first client render both show nothing — no hydration mismatch.
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { page } from '$app/stores';
  import X from '@lucide/svelte/icons/x';
  import { href, routePath, locales, getLocale } from '$lib/i18n.js';
  import { LOCALE_META } from '$lib/locales.js';
  import LocaleFlag from '$lib/LocaleFlag.svelte';

  const STORAGE_KEY = 'mc-locale-suggest-dismissed';

  // The locale to suggest, or null when there's nothing to offer.
  let target = $state(null);

  let currentPath = $derived(routePath($page.url.pathname));
  let meta = $derived(target ? LOCALE_META[target] : null);

  onMount(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // localStorage unavailable (private mode) — just proceed without persistence.
    }

    const active = getLocale();
    const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];

    // The first browser preference that maps to a locale we ship decides: if it's
    // the locale they're already viewing, stay quiet; if it differs, offer it.
    for (const pref of prefs) {
      const base = String(pref).toLowerCase().split('-')[0];
      const match = locales.find((l) => l.toLowerCase().split('-')[0] === base);
      if (!match) continue;
      if (match !== active) target = match;
      break;
    }
  });

  function dismiss() {
    target = null;
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore storage failures
    }
  }
</script>

{#if target && meta}
  <div
    transition:slide={{ duration: 300, easing: quintOut }}
    class="overflow-hidden border-b border-accent/30 bg-accent/10 text-ink"
  >
    <div
      class="mx-auto flex w-full max-w-[1100px] items-center gap-3 px-[clamp(1rem,4vw,2rem)] py-2.5 text-[0.9rem]"
    >
      <LocaleFlag flag={meta.flag} flagUrl={meta.flagUrl} />
      <span class="min-w-0 flex-1">{meta.greeting}</span>
      <a
        href={href(currentPath, target)}
        data-sveltekit-reload
        class="shrink-0 rounded-md border border-accent bg-accent px-2.5 py-1 text-[0.82rem] font-semibold text-bg transition hover:bg-accent/90"
      >
        {meta.cta}
      </a>
      <button
        type="button"
        onclick={dismiss}
        aria-label={meta.dismiss}
        class="shrink-0 rounded-md p-1 text-dim transition hover:bg-elev2 hover:text-ink"
      >
        <X class="size-4" />
      </button>
    </div>
  </div>
{/if}
