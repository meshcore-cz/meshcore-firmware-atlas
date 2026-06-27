<script>
  import Seo from '$lib/Seo.svelte';
  import SoftwareList from '$lib/SoftwareList.svelte';
  import { m } from '$lib/paraglide/messages.js';
  let { data } = $props();
</script>

<Seo
  title={m.collection_software_label()}
  description={m.seo_software_index_desc({ count: data.software.length })}
/>

<SoftwareList software={data.software} />
