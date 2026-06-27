import { isDeviceCategory } from '$lib/device-categories.js';

/** @param {string} param */
export function match(param) {
  return isDeviceCategory(param);
}
