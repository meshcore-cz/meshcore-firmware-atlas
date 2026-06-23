import { allSchemas } from '$lib/schemas.js';

export function load() {
  return { schemas: allSchemas() };
}
