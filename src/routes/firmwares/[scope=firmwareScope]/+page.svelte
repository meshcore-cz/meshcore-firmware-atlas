<script>
  import Seo from '$lib/Seo.svelte';
  import FirmwareList from '$lib/FirmwareList.svelte';
  import { lcFirst } from '$lib/data.js';
  import { m } from '$lib/paraglide/messages.js';
  let { data } = $props();

  const LABELS = {
    universal: m.fw_scope_universal,
    'platform-specific': m.fw_scope_platform,
    'function-specific': m.fw_scope_function,
    'device-specific': m.fw_scope_device
  };
  let label = $derived((LABELS[data.scope] ?? m.collection_firmwares_label)());
  let count = $derived(
    data.firmwares.filter((fw) => (fw.scope ?? 'device-specific') === data.scope).length
  );
</script>

<Seo
  title={m.seo_firmwares_scope_title({ label, labelLc: lcFirst(label) })}
  description={m.seo_firmwares_scope_desc({ count, labelLc: lcFirst(label) })}
/>

<FirmwareList firmwares={data.firmwares} activeScope={data.scope} />
