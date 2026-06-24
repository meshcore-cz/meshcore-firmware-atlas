import {
  devices,
  deviceMcuLabel,
  deviceRadioLabel,
  devicePriceLabel,
  bandLabel
} from '$lib/data.js';

// Every device with a bundled thumbnail, plus the handful of fields the gallery
// lightbox shows. The grid itself is purely visual.
export function load() {
  return {
    devices: devices
      .filter((d) => d.imageUrl)
      .map((d) => {
        const bands = [
          ...new Set((d.hardware?.radios ?? []).flatMap((r) => (r.bands ?? []).map(String)))
        ];
        return {
          id: d.id,
          name: d.name,
          imageUrl: d.imageUrl,
          vendorName: d.vendorName,
          mcu: deviceMcuLabel(d),
          radio: deviceRadioLabel(d),
          price: devicePriceLabel(d),
          roles: d.roles ?? [],
          bands: bands.map((b) => bandLabel(b)).filter(Boolean)
        };
      })
  };
}
