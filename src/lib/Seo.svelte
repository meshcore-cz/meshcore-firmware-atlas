<script>
  // Per-page SEO + social metadata. Emits title, description, canonical URL,
  // OpenGraph + Twitter cards, and optional JSON-LD structured data.
  import { page } from '$app/stores';
  import { SITE_ORIGIN, SITE_NAME, abs, absUrl } from '$lib/seo.js';
  import { routePath, locales, getLocale, baseLocale } from '$lib/i18n.js';
  import { localizeHref } from '$lib/paraglide/runtime.js';
  import { localeMeta } from '$lib/locales.js';

  // OpenGraph locale from the central registry ($lib/locales.js); falls back to
  // the bare code for anything unexpected.
  const ogLocale = (loc) => localeMeta(loc)?.ogLocale ?? loc;

  let {
    title = '',
    description = '',
    // Root-absolute image path (already including the base path). Falls back to
    // the site-wide social card.
    image = null,
    type = 'website',
    noindex = false,
    jsonLd = null
  } = $props();

  // Build canonical from the configured origin + current path so prerendered
  // pages don't emit the placeholder origin SvelteKit uses while building.
  let canonical = $derived(SITE_ORIGIN + $page.url.pathname);
  let fullTitle = $derived(title && title !== SITE_NAME ? `${title} — ${SITE_NAME}` : SITE_NAME);
  let ogImage = $derived(image ? abs(image) : absUrl('/og.png'));

  // hreflang alternates: the same page in each locale, plus an x-default that
  // points at the base-locale (English) URL. Built from the current path with
  // the deploy base + locale prefix stripped, so it stays correct on every page.
  let bareRoute = $derived(routePath($page.url.pathname));
  let alternates = $derived(
    locales.map((locale) => ({ locale, url: absUrl(localizeHref(bareRoute, { locale })) }))
  );
  let xDefaultUrl = $derived(absUrl(localizeHref(bareRoute, { locale: baseLocale })));
  let activeLocale = $derived(getLocale());

  // Build the <script> tag without any literal script token in the source, so
  // Svelte's tag scanner and the JS parser don't mis-read this block. Escaping
  // "<" in the payload also prevents a real closing tag from sneaking in.
  let jsonLdTag = $derived(
    jsonLd
      ? `<${'script'} type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</${'script'}>`
      : ''
  );
</script>

<svelte:head>
  <title>{fullTitle}</title>
  {#if description}<meta name="description" content={description} />{/if}
  <link rel="canonical" href={canonical} />
  {#each alternates as alt}
    <link rel="alternate" hreflang={alt.locale} href={alt.url} />
  {/each}
  <link rel="alternate" hreflang="x-default" href={xDefaultUrl} />
  {#if noindex}<meta name="robots" content="noindex" />{/if}

  <meta property="og:type" content={type} />
  <meta property="og:locale" content={ogLocale(activeLocale)} />
  {#each alternates as alt}
    {#if alt.locale !== activeLocale}<meta property="og:locale:alternate" content={ogLocale(alt.locale)} />{/if}
  {/each}
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:title" content={fullTitle} />
  {#if description}<meta property="og:description" content={description} />{/if}
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={ogImage} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={fullTitle} />
  {#if description}<meta name="twitter:description" content={description} />{/if}
  <meta name="twitter:image" content={ogImage} />

  {#if jsonLdTag}{@html jsonLdTag}{/if}
</svelte:head>
