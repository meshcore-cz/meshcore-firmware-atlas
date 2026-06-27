<script>
  import Seo from '$lib/Seo.svelte';
  import DeviceList from '$lib/DeviceList.svelte';
  import { lcFirst } from '$lib/data.js';
  import { m } from '$lib/paraglide/messages.js';
  let { data } = $props();

  const LABELS = {
    'development-board': m.dev_cat_development_board,
    'companion-radio': m.dev_cat_companion_radio,
    standalone: m.dev_cat_standalone,
    tracker: m.dev_cat_tracker,
    repeater: m.dev_cat_repeater,
    other: m.dev_cat_other
  };
  let label = $derived((LABELS[data.category] ?? m.collection_devices_label)());
  let count = $derived(data.devices.filter((d) => d.category === data.category).length);
</script>

<Seo
  title={m.seo_devices_cat_title({ label })}
  description={m.seo_devices_cat_desc({ count, labelLc: lcFirst(label) })}
/>

<DeviceList devices={data.devices} activeCategory={data.category} />
