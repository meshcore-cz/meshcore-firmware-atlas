import * as yaml from 'js-yaml';
import fs from 'node:fs';
import path from 'node:path';

const devicesDir = 'data/devices';
const ids = fs.readdirSync(devicesDir).filter((id) => {
  const dir = path.join(devicesDir, id);
  return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, 'device.yaml'));
});

const DRY_RUN = true; // set to false to apply
let changedFiles = 0;
let changedPrints = 0;

for (const id of ids) {
  const file = path.join(devicesDir, id, 'device.yaml');
  const text = fs.readFileSync(file, 'utf8');
  const device = yaml.load(text);
  const prints = device.prints ?? [];
  if (prints.length === 0) continue;

  const builtIn = device.hardware?.enclosure?.builtIn;
  // Devices that are already known to ship with an enclosure get accessory-grade
  // cases; everything else (dev-boards, modules, products without a factory case)
  // gets full enclosures.
  const targetHousingType = builtIn === true ? 'case' : 'enclosure';

  let fileChanged = false;
  // We edit the original text so we don't reformat the whole YAML.
  let newText = text;

  for (const p of prints) {
    const current = p.type ?? 'case';
    // Only reclassify full housings (case/enclosure). Leave accessories alone.
    if (current === 'accessory') continue;

    const desired = targetHousingType;
    if (current === desired) continue;

    // Find this print's block in the original text and update its type line.
    // Match the exact name and the type line that follows it (within a prints item).
    const name = p.name;
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `(- name: *(?:"${escapedName}"|'${escapedName}'|${escapedName.split(' ').length > 1 ? '' : escapedName})\\s*\\n)(\\s*)(type: *${current})`,
      'g'
    );

    // Build a matcher that searches the prints section only (last occurrence of
    // `prints:` to end of file) so we don't accidentally hit comments elsewhere.
    const printsSectionMatch = newText.match(/\nprints:\s*\n[\s\S]*$/);
    if (!printsSectionMatch) continue;
    const sectionStart = printsSectionMatch.index;
    const section = printsSectionMatch[0];

    // Replace only within the prints section.
    let sectionReplaced = false;
    const newSection = section.replace(
      /(- name: *(?:"[^"]+"|'[^']+'|[^\n]+)\n)(\s*)(type: *case|type: *enclosure)/g,
      (match, nameLine, indent, typeLine) => {
        const blockName = nameLine.replace(/^- name:\s*/, '').replace(/^["']|["']\s*\n$/g, '').trim();
        if (blockName !== name) return match;
        sectionReplaced = true;
        return `${nameLine}${indent}type: ${desired}`;
      }
    );

    if (sectionReplaced) {
      newText = newText.slice(0, sectionStart) + newSection;
      changedPrints++;
      fileChanged = true;
    }
  }

  if (fileChanged) {
    fs.writeFileSync(file, newText, 'utf8');
    changedFiles++;
  }
}

console.log(`Reclassified ${changedPrints} prints across ${changedFiles} devices.`);
