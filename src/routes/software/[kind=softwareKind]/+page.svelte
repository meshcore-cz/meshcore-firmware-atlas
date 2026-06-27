<script>
  import Seo from '$lib/Seo.svelte';
  import SoftwareList from '$lib/SoftwareList.svelte';
  import { softwareKindLabel, lcFirst } from '$lib/data.js';
  import { m } from '$lib/paraglide/messages.js';
  let { data } = $props();

  let label = $derived(softwareKindLabel(data.kind));
  let count = $derived(data.software.filter((s) => s.kind === data.kind).length);
</script>

<Seo
  title={m.seo_software_kind_title({ label })}
  description={m.seo_software_kind_desc({ count, labelLc: lcFirst(label) })}
/>

<SoftwareList software={data.software} activeKind={data.kind} />
