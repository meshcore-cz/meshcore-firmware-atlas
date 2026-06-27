// Localized labels for device-rank metrics (browser / Svelte only).
import { m } from '$lib/paraglide/messages.js';
import { metricById } from '$lib/metrics.js';

/** Localized metric name for UI. */
export function metricLabel(id) {
  switch (id) {
    case 'battery':
      return m.rank_metric_battery();
    case 'tx-power':
      return m.rank_metric_tx_power();
    case 'flash':
      return m.rank_metric_flash();
    case 'ram':
      return m.rank_metric_ram();
    case 'psram':
      return m.rank_metric_psram();
    case 'idle-draw':
      return m.rank_metric_idle_draw();
    case 'tx-draw':
      return m.rank_metric_tx_draw();
    case 'solar':
      return m.rank_metric_solar();
    case 'idle-runtime':
      return m.rank_metric_idle_runtime();
    case 'tx-efficiency':
      return m.rank_metric_tx_efficiency();
    case 'weight':
      return m.rank_metric_weight();
    case 'area':
      return m.rank_metric_area();
    case 'volume':
      return m.rank_metric_volume();
    case 'display-size':
      return m.rank_metric_display_size();
    case 'display-pixels':
      return m.rank_metric_display_pixels();
    case 'firmware-support':
      return m.rank_metric_firmware_support();
    case '3d-models':
      return m.rank_metric_3d_models();
    case 'completeness':
      return m.rank_metric_completeness();
    case 'price':
      return m.rank_metric_price();
    default:
      return metricById(id)?.label ?? id;
  }
}

/** Localized unit suffix for a metric (technical units stay as-is). */
export function metricUnit(id) {
  switch (id) {
    case 'firmware-support':
      return m.rank_unit_firmwares();
    case '3d-models':
      return m.rank_unit_models();
    default:
      return metricById(id)?.unit ?? '';
  }
}

/** Chip / column heading: label plus unit in parentheses. */
export function metricHeading(id) {
  const label = metricLabel(id);
  const unit = metricUnit(id);
  return unit ? `${label} (${unit})` : label;
}
