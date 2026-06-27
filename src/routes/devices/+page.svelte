<script>
  import Seo from '$lib/Seo.svelte';
  import DeviceList from '$lib/DeviceList.svelte';
  import { m } from '$lib/paraglide/messages.js';
  let { data } = $props();
</script>

<Seo
  title={m.collection_devices_label()}
  description={m.seo_devices_index_desc({ count: data.devices.length })}
/>

<DeviceList devices={data.devices} />
