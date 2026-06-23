<script>
  // One property/sub-schema in the schema explorer tree. A node's own info
  // (type, description, constraints, enum, examples) is always visible; its
  // nested child properties live behind a collapsible toggle so the tree stays
  // scannable. `root` is the owning schema, carried down so `$ref`s into its
  // `$defs` resolve. Array-of-object nodes hoist the item's properties directly
  // (no redundant `items` wrapper).
  import Self from '$lib/SchemaNode.svelte';
  import { resolveRef, typeLabel, constraintChips } from '$lib/schemas.js';

  let {
    /** Property key, or null for the schema root. */
    name = null,
    schema,
    root,
    required = false,
    /** Nesting depth — children get an indented left rule. */
    depth = 0,
    /** Initial expanded state, forwarded to children so expand-all is recursive. */
    defaultOpen = false
  } = $props();

  // Follow a single $ref so we render the target's shape inline, keeping the
  // node's own description when it overrides the target's.
  function deref(s) {
    return s?.$ref ? (resolveRef(s.$ref, root) ?? s) : s;
  }

  let resolved = $derived(deref(schema));
  let refName = $derived(
    schema?.$ref?.startsWith('#/$defs/') ? schema.$ref.slice('#/$defs/'.length) : null
  );
  let description = $derived(schema?.description ?? resolved?.description ?? '');
  let chips = $derived(constraintChips(resolved));
  let examples = $derived(
    resolved?.examples ?? (resolved?.example !== undefined ? [resolved.example] : [])
  );

  // Array handling: resolve the item schema and decide whether it's a list of
  // objects (whose properties we hoist) or a list of scalars (whose enum /
  // constraints we surface inline on this node).
  let items = $derived(
    resolved?.type === 'array' && resolved.items && !Array.isArray(resolved.items)
      ? deref(resolved.items)
      : null
  );
  let isObjectArray = $derived(!!(items && (items.properties || items.type === 'object')));
  let scalarItems = $derived(items && !isObjectArray ? items : null);

  // The object whose properties become this node's children: the array's item
  // schema for object arrays, otherwise the node itself.
  function objectChildren(s) {
    if (!s) return [];
    const requiredSet = new Set(s.required ?? []);
    const out = [];
    for (const [key, child] of Object.entries(s.properties ?? {})) {
      out.push({ name: key, schema: child, required: requiredSet.has(key) });
    }
    for (const [pattern, child] of Object.entries(s.patternProperties ?? {})) {
      out.push({ name: `/${pattern}/`, schema: child, required: false });
    }
    if (s.additionalProperties && typeof s.additionalProperties === 'object') {
      out.push({ name: '«key»', schema: s.additionalProperties, required: false });
    }
    const branches = s.oneOf ?? s.anyOf ?? s.allOf;
    if (Array.isArray(branches)) {
      branches.forEach((b, i) => out.push({ name: `option ${i + 1}`, schema: b, required: false }));
    }
    return out;
  }

  let children = $derived(objectChildren(isObjectArray ? items : resolved));
  let hasChildren = $derived(children.length > 0);

  // Enum / const can sit on the node itself or on a scalar array's items.
  let enumValues = $derived(resolved?.enum ?? scalarItems?.enum ?? null);
  let constValue = $derived(resolved?.const ?? scalarItems?.const);
  // Constraints that belong to scalar array items, shown after the node's own.
  let itemChips = $derived(scalarItems ? constraintChips(scalarItems) : []);

  let openState = $state(defaultOpen);
  const childLabel = $derived(
    `${children.length} ${children.length === 1 ? 'field' : 'fields'}${isObjectArray ? ' per item' : ''}`
  );

  const fmt = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
</script>

<div class={depth > 0 ? 'border-l border-edge/70 pl-4' : ''}>
  <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
    {#if name != null}
      <code class="font-mono text-[0.92rem] font-semibold text-ink">{name}</code>
    {/if}
    <span class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.72rem] text-accent">{typeLabel(schema, root)}</span>
    {#if refName}
      <span class="font-mono text-[0.7rem] text-dim">{refName}</span>
    {/if}
    {#if required}
      <span class="rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[0.66rem] font-medium text-warn">required</span>
    {/if}
  </div>

  {#if description}
    <p class="mt-1 max-w-[72ch] text-[0.86rem] leading-relaxed text-dim">{description}</p>
  {/if}

  {#if enumValues}
    <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span class="text-[0.7rem] uppercase tracking-wide text-dim/70">one of</span>
      {#each enumValues as v}
        <code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.76rem] text-ink">{fmt(v)}</code>
      {/each}
    </div>
  {/if}

  {#if constValue !== undefined}
    <div class="mt-1.5">
      <code class="rounded bg-elev2 px-1.5 py-0.5 font-mono text-[0.76rem] text-ink">{fmt(constValue)}</code>
    </div>
  {/if}

  {#if chips.length || itemChips.length}
    <div class="mt-1.5 flex flex-wrap gap-1.5">
      {#each chips as [label, value]}
        <span class="rounded-full border border-edge bg-elev px-2 py-0.5 text-[0.7rem] text-dim">
          {label} <span class="font-mono text-ink">{value}</span>
        </span>
      {/each}
      {#each itemChips as [label, value]}
        <span class="rounded-full border border-edge bg-elev px-2 py-0.5 text-[0.7rem] text-dim">
          item {label} <span class="font-mono text-ink">{value}</span>
        </span>
      {/each}
    </div>
  {/if}

  {#if examples?.length}
    <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span class="text-[0.7rem] uppercase tracking-wide text-dim/70">{examples.length > 1 ? 'examples' : 'e.g.'}</span>
      {#each examples as ex}
        <code class="rounded bg-accent2/10 px-1.5 py-0.5 font-mono text-[0.76rem] text-accent2">{fmt(ex)}</code>
      {/each}
    </div>
  {/if}

  {#if hasChildren}
    <button
      type="button"
      class="mt-2 flex items-center gap-1.5 text-[0.76rem] font-medium text-dim transition hover:text-accent"
      aria-expanded={openState}
      onclick={() => (openState = !openState)}
    >
      <svg
        class="h-3.5 w-3.5 transition-transform {openState ? 'rotate-90' : ''}"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"
      >
        <path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {openState ? 'Hide' : 'Show'} {childLabel}
    </button>

    {#if openState}
      <div class="mt-3 flex flex-col gap-4">
        {#each children as child}
          <Self name={child.name} schema={child.schema} {root} required={child.required} depth={depth + 1} {defaultOpen} />
        {/each}
      </div>
    {/if}
  {/if}
</div>
