import * as yaml from 'js-yaml';
import fs from 'node:fs';
import path from 'node:path';

const devicesDir = 'data/devices';
const ids = fs.readdirSync(devicesDir).filter((id) => {
  const dir = path.join(devicesDir, id);
  return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, 'device.yaml'));
});

let mismatches = 0;
console.log('| Device | builtIn | name | type | expected |');
console.log('|--------|---------|------|------|----------|');
for (const id of ids) {
  const file = path.join(devicesDir, id, 'device.yaml');
  const device = yaml.load(fs.readFileSync(file, 'utf8'));
  const prints = device.prints ?? [];
  if (prints.length === 0) continue;
  const builtIn = device.hardware?.enclosure?.builtIn;
  const expected = builtIn === true ? 'case' : 'enclosure';
  for (const p of prints) {
    const t = p.type ?? 'case';
    if (t === 'accessory') continue;
    if (t !== expected) {
      console.log(`| ${id} | ${builtIn ?? 'none'} | ${p.name.replace(/\|/g, '\\|')} | ${t} | ${expected} |`);
      mismatches++;
    }
  }
}
console.log(`\nRemaining mismatches: ${mismatches}`);
