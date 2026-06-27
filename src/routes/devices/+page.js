import { devices, firmwaresForDevice } from '$lib/data.js';
import { localizeCollection } from '$lib/catalog-overlay.js';

export function load() {
  return {
    devices: localizeCollection('device', devices).map((d) => ({
      ...d,
      firmwareCount: firmwaresForDevice(d.id).length
    }))
  };
}
