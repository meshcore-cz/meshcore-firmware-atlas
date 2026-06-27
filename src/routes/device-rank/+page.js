import { redirect } from '@sveltejs/kit';
import { href } from '$lib/i18n.js';
import { METRICS } from '$lib/metrics.js';

export function load() {
  redirect(307, href(`/device-rank/${METRICS[0].id}/`));
}
