<script>
  import Seo from '$lib/Seo.svelte';
  import PrintList from '$lib/PrintList.svelte';
  import { m } from '$lib/paraglide/messages.js';
  let { data } = $props();
</script>

<Seo title={m.tool_prints_label()} description={m.seo_prints_index_desc()} />

<PrintList prints={data.prints} types={data.types} />
