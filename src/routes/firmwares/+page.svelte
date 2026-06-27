<script>
  import Seo from '$lib/Seo.svelte';
  import FirmwareList from '$lib/FirmwareList.svelte';
  import { m } from '$lib/paraglide/messages.js';
  let { data } = $props();
</script>

<Seo title={m.collection_firmwares_label()} description={m.seo_firmwares_index_desc()} />

<FirmwareList firmwares={data.firmwares} />
