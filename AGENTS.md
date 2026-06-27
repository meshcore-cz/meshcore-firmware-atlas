# Agent guide — MeshCore Ninja

Operational notes for AI agents working in this repo.

> **Editing data?** Read [`data/RULES.md`](data/RULES.md) first — it's the
> authoring guide (naming, datasheets, prices, built-in vs optional hardware,
> catalog, pitfalls, checklist) for humans and agents alike.
> Field reference: [`data/SCHEMA.md`](data/SCHEMA.md). Machine contracts:
> [`schema/`](schema/).

## What this repo is

A static SvelteKit site cataloging MeshCore (and related) firmware support for
LoRa hardware. All content lives in YAML under `data/`; the app imports compiled
`src/lib/generated/data.json` (built from that YAML).

## Working in this repo

```bash
npm test              # validate all YAML against JSON Schema + referential checks
npm run build:data    # regenerate data.json and static/schema/*.json
```

- Run **`npm test`** after every data change; run **`build:data`** when `schema/`
  or `data/globals.yaml` change (dev/build hooks usually do this automatically).
- Do **not** create git commits or PRs unless the user explicitly asks.
- Keep diffs focused; don't refactor unrelated UI or bulk-edit all devices unless asked.

## UI / code conventions (when touching `src/`)

- Hero strip **strips the vendor prefix** from catalog MCU/radio names
  (`ESP32-S3`, not `Espressif ESP32-S3`).
- Component datasheet links come from `data/globals.yaml`; device PDFs use `datasheetUrl`.
- Reuse existing helpers in `src/lib/data.js` (`resolveMcuInfo`,
  `deviceDisplayLabel`, `devicePriceLabel`, etc.).

## Adding a language

Two edits, then translate:

1. Add the locale code to `locales` in
   [`project.inlang/settings.json`](project.inlang/settings.json) (Paraglide's
   source of truth for messages + URL routing).
2. Add a matching entry to `LOCALE_META` in
   [`src/lib/locales.js`](src/lib/locales.js) — the **central registry** for
   per-locale metadata (switcher endonym + flag, English name, OpenGraph
   locale). The switcher, SEO and translation tooling all read from here.
3. Create `messages/<locale>.json` (UI strings, incl. `route_slug_*`) and the
   catalog overlays under `data/i18n/sources/<locale>/`.

`scripts/check-locales.js` (run by `npm test`) fails if the registry and
`settings.json` ever drift, so a half-added language won't slip through.

## Catalog translation

```bash
npm run i18n:translate              # all non-base locales
npm run i18n:translate -- --locale cs
npm run i18n:translate -- -l pt      # short form
npm run build:data                  # rebuild runtime overlays
npm run i18n:status                 # coverage report
```

`--locale` / `-l` limits batch translation to one target locale. Fields whose
`sourceHash` already match are skipped. Use `npm run i18n:translate:test` to
try a single field interactively.

## Before finishing

- `npm test` passes.
- For data changes, follow the contributor checklist in
  [`data/RULES.md`](data/RULES.md).
