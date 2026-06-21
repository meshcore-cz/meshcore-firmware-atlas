import { firmwares } from '$lib/data.js';

// Strip the heavy release history; the compare view only needs metadata,
// capabilities and a device count.
export function load() {
  return {
    firmwares: firmwares.map(({ releases, devices, ...f }) => ({
      ...f,
      deviceCount: devices?.length ?? 0
    }))
  };
}
