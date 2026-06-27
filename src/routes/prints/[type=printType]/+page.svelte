<script>
  import Seo from '$lib/Seo.svelte';
  import PrintList from '$lib/PrintList.svelte';
  import { printType, printTypeLabel, lcFirst } from '$lib/data.js';
  import { m } from '$lib/paraglide/messages.js';
  let { data } = $props();

  let label = $derived(printTypeLabel(data.type));
  let count = $derived(data.prints.filter((p) => printType(p) === data.type).length);
</script>

<Seo
  title={m.seo_prints_type_title({ labelLc: lcFirst(label) })}
  description={m.seo_prints_type_desc({ count, labelLc: lcFirst(label) })}
/>

<PrintList prints={data.prints} types={data.types} activeType={data.type} />
