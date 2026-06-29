<script>
  // Language switcher built on bits-ui Select: shows the country flag and the
  // language's own name (endonym). Changing the value triggers a full-page
  // navigation so the URL-based locale strategy re-resolves (see i18n.js).
  import { Select } from 'bits-ui';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { page } from '$app/stores';
  import { href, routePath, locales, getLocale } from '$lib/i18n.js';
  import { LOCALE_META } from '$lib/locales.js';
  import LocaleFlag from '$lib/LocaleFlag.svelte';
  import { m } from '$lib/paraglide/messages.js';

  // Endonym + flag come from the central locale registry ($lib/locales.js).
  // Names stay in their own language (the endonym) by convention.
  const meta = (loc) => {
    const info = LOCALE_META[loc];
    return info
      ? { name: info.endonym, flag: info.flag, flagUrl: info.flagUrl ?? null }
      : { name: loc, flag: null, flagUrl: null };
  };

  let { class: triggerClass = '' } = $props();

  let currentPath = $derived(routePath($page.url.pathname));
  let active = $derived(getLocale());

  const visibleLocales = locales.filter((loc) => !LOCALE_META[loc]?.hidden);
  const items = visibleLocales.map((loc) => ({ value: loc, label: meta(loc).name }));

  function onValueChange(loc) {
    if (loc && loc !== active && typeof window !== 'undefined') {
      window.location.href = href(currentPath, loc);
    }
  }
</script>

<Select.Root type="single" value={active} {onValueChange} {items}>
  <Select.Trigger
    aria-label={m.language_switcher_label()}
    class={`flex items-center gap-2 rounded-md border border-edge bg-bg px-2.5 text-[0.85rem] text-dim outline-none transition-colors hover:border-accent hover:text-ink focus:border-accent data-[state=open]:border-accent ${triggerClass}`}
  >
    <LocaleFlag flag={meta(active).flag} flagUrl={meta(active).flagUrl} />
    <span class="truncate">{meta(active).name}</span>
    <ChevronDown class="ml-auto size-4 shrink-0 transition-transform data-[state=open]:rotate-180" />
  </Select.Trigger>

  <Select.Portal>
    <Select.Content
      class="z-50 max-h-72 min-w-[var(--bits-select-anchor-width)] overflow-y-auto rounded-lg border border-edge bg-elev2 p-1 text-ink shadow-lg shadow-black/30 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out"
      sideOffset={6}
    >
      <Select.Viewport>
        {#each visibleLocales as loc (loc)}
          <Select.Item
            value={loc}
            label={meta(loc).name}
            class="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[0.85rem] outline-none data-[highlighted]:bg-accent/15 data-[highlighted]:text-accent"
          >
            {#snippet children({ selected })}
              <LocaleFlag flag={meta(loc).flag} flagUrl={meta(loc).flagUrl} />
              <span class="truncate">{meta(loc).name}</span>
              <span class="ml-auto flex size-4 shrink-0 items-center justify-center">
                {#if selected}<Check class="size-4 text-accent" />{/if}
              </span>
            {/snippet}
          </Select.Item>
        {/each}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
