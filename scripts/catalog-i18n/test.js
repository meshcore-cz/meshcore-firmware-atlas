import assert from 'node:assert/strict';
import { translationPrompt, cleanTranslationOutput } from './prompt.js';
import { sourceHash } from '../../src/lib/catalog-i18n/source-hash.js';
import { noteId } from '../../src/lib/catalog-i18n/ids.js';
import { extractTranslatableFields, fieldsToResourceOverlay } from '../../src/lib/catalog-i18n/fields.js';
import { applyResourceOverlay, resolveOverlayPath } from '../../src/lib/catalog-i18n/merge.js';
import { applyRepeaterCommandsOverlay } from '../../src/lib/catalog-i18n/repeater-commands.js';
import {
  currentOverlayFields
} from './build-overlays.js';
import { resolveTargetLocales } from './translate.js';

const software = {
  id: 'mc-webui',
  description: 'English description.',
  screenshots: [
    { file: 'map.png', caption: 'Map view' },
    { file: 'chat.jpg', caption: 'Chat view' }
  ],
  verification: {
    notes: [
      'Designed for trusted local networks.',
      'Multi-architecture images are published for amd64.'
    ]
  }
};

// Canonical without overlay
{
  const out = applyResourceOverlay(software, undefined);
  assert.equal(out.description, 'English description.');
}

// Current translation applied
{
  const overlay = {
    description: 'Czech description.',
    screenshots: { 'map.png': { caption: 'Mapa' } },
    verificationNotes: {
      [noteId('Designed for trusted local networks.')]: 'Pro důvěryhodné sítě.'
    }
  };
  const out = applyResourceOverlay(software, overlay);
  assert.equal(out.description, 'Czech description.');
  assert.equal(out.screenshots.find((s) => s.file === 'map.png').caption, 'Mapa');
  assert.equal(out.screenshots.find((s) => s.file === 'chat.jpg').caption, 'Chat view');
  assert.equal(out.verification.notes[0], 'Pro důvěryhodné sítě.');
}

// Missing translation preserves English
{
  const overlay = { description: 'Only this field' };
  const out = applyResourceOverlay(software, overlay);
  assert.equal(out.screenshots[0].caption, 'Map view');
}

// Stale translation excluded from runtime overlay build
{
  const canonical = extractTranslatableFields('software', software);
  const map = Object.fromEntries(canonical.map((f) => [f.path, f]));
  const current = currentOverlayFields(
    Object.fromEntries(canonical.map((f) => [f.path, { value: f.value, sourceHash: f.sourceHash }])),
    {
      description: { value: 'Stale', sourceHash: 'sha256:' + '0'.repeat(64) },
      'screenshots.map.png.caption': {
        value: 'Stale caption',
        sourceHash: map['screenshots.map.png.caption'].sourceHash
      }
    }
  );
  assert.equal(current['description'], undefined);
  assert.equal(current['screenshots.map.png.caption'].value, 'Stale caption');
}

// Reordered screenshots
{
  const reordered = {
    ...software,
    screenshots: [
      { file: 'chat.jpg', caption: 'Chat view' },
      { file: 'map.png', caption: 'Map view' }
    ]
  };
  const overlay = { screenshots: { 'map.png': { caption: 'Mapa' } } };
  const out = applyResourceOverlay(reordered, overlay);
  assert.equal(out.screenshots[0].caption, 'Chat view');
  assert.equal(out.screenshots[1].caption, 'Mapa');
}

// Reordered verification notes
{
  const reordered = {
    ...software,
    verification: {
      notes: [
        'Multi-architecture images are published for amd64.',
        'Designed for trusted local networks.'
      ]
    }
  };
  const overlay = {
    verificationNotes: {
      [noteId('Designed for trusted local networks.')]: 'Přeloženo'
    }
  };
  const out = applyResourceOverlay(reordered, overlay);
  assert.equal(out.verification.notes[1], 'Přeloženo');
}

// Features overlay (whole array as one translatable field)
{
  const firmware = {
    id: 'easyskymesh',
    features: ['Ultra-low-power operation', 'Sensor integration']
  };
  const canonical = extractTranslatableFields('firmware', firmware);
  const featuresField = canonical.find((f) => f.path === 'features');
  assert.ok(featuresField);
  assert.equal(featuresField.value, JSON.stringify(firmware.features));

  const overlay = fieldsToResourceOverlay({
    features: {
      value: JSON.stringify(['Provoz s ultra nízkou spotřebou', 'Integrace senzorů'])
    }
  });
  const out = applyResourceOverlay(firmware, overlay);
  assert.deepEqual(out.features, ['Provoz s ultra nízkou spotřebou', 'Integrace senzorů']);
}

// Tags overlay (whole array as one translatable field)
{
  const item = {
    id: 'meshcore-sar',
    tags: ['search-and-rescue', 'offline', 'voice']
  };
  const canonical = extractTranslatableFields('software', item);
  const tagsField = canonical.find((f) => f.path === 'tags');
  assert.ok(tagsField);
  assert.equal(tagsField.value, JSON.stringify(item.tags));

  const overlay = fieldsToResourceOverlay({
    tags: {
      value: JSON.stringify(['Pátrání a záchrana', 'Offline', 'Hlas'])
    }
  });
  const out = applyResourceOverlay(item, overlay);
  assert.deepEqual(out.tags, ['Pátrání a záchrana', 'Offline', 'Hlas']);
}

// Deterministic merging
{
  const fields = {
    description: { value: 'A' },
    'verificationNotes.foo': { value: 'B' }
  };
  const a = fieldsToResourceOverlay(fields);
  const b = fieldsToResourceOverlay(fields);
  assert.deepEqual(a, b);
}

// Components receive normal catalog schema shape
{
  const overlay = fieldsToResourceOverlay({
    description: { value: 'Czech' },
    'screenshots.map.png.caption': { value: 'Mapa' }
  });
  const out = applyResourceOverlay(software, overlay);
  assert.equal(typeof out.description, 'string');
  assert.ok(Array.isArray(out.screenshots));
  assert.ok(Array.isArray(out.verification.notes));
  assert.equal(typeof out.verification.notes[0], 'string');
}

// Reordered screenshots with dotted filenames
{
  const dotted = {
    ...software,
    screenshots: [
      { file: 'chat.jpg', caption: 'Chat view' },
      { file: 'main-window.png', caption: 'Map view' }
    ]
  };
  const overlay = { screenshots: { 'main-window.png': { caption: 'Mapa' } } };
  const out = applyResourceOverlay(dotted, overlay);
  assert.equal(out.screenshots[1].caption, 'Mapa');
}

// Components receive screenshotUrls (with bundled asset URLs), not raw screenshots.
{
  const withUrls = {
    ...software,
    screenshotUrls: software.screenshots.map((shot) => ({ ...shot, url: `/img/${shot.file}` }))
  };
  const overlay = { screenshots: { 'map.png': { caption: 'Mapa' } } };
  const out = applyResourceOverlay(withUrls, overlay);
  assert.equal(out.screenshotUrls.find((s) => s.file === 'map.png').caption, 'Mapa');
  assert.equal(out.screenshots.find((s) => s.file === 'map.png').caption, 'Mapa');
}

// Prompt includes target language, locale code, and source text.
{
  const prompt = translationPrompt('cs', 'Self-hosted web client.');
  assert.match(prompt, /software localizer for Czech \(cs\)/);
  assert.match(prompt, /Source:\nSelf-hosted web client\./);
  assert.doesNotMatch(prompt, /hostovaný/);
}

{
  assert.equal(cleanTranslationOutput('"Ahoj"'), 'Ahoj');
  assert.equal(cleanTranslationOutput('Ahoj'), 'Ahoj');
}

// Repeater commands overlay (chunk adapter)
{
  const groups = [
    {
      id: 'power',
      label: 'Power & reboot',
      blurb: 'Group blurb',
      commands: [
        { cmd: 'reboot', desc: 'Restart the node.' },
        { name: 'radio', get: true, desc: 'LoRa settings.', range: '150–2500 MHz' }
      ]
    }
  ];
  const flags = {
    serial: { label: 'USB only', tone: 'amber', desc: 'Serial console only.' }
  };
  const canonical = extractTranslatableFields('repeater-commands', { groups, flags });
  assert.equal(canonical.length, 2);
  assert.ok(canonical.some((f) => f.path === 'rc.groups.power'));
  assert.ok(canonical.some((f) => f.path === 'rc.flags'));

  const overlay = fieldsToResourceOverlay({
    'rc.groups.power': {
      value: JSON.stringify({
        label: 'Napájení a restart',
        blurb: 'Group blurb',
        commands: {
          reboot: { desc: 'Restartuje uzel.' },
          radio: { desc: 'LoRa settings.', range: '150–2500 MHz' }
        }
      })
    },
    'rc.flags': {
      value: JSON.stringify({ serial: { label: 'Pouze USB', desc: 'Pouze sériová konzole.' } })
    }
  });
  const out = applyRepeaterCommandsOverlay(groups, flags, overlay);
  assert.equal(out.groups[0].label, 'Napájení a restart');
  assert.equal(out.groups[0].commands[0].desc, 'Restartuje uzel.');
  assert.equal(out.groups[0].commands[1].range, '150–2500 MHz');
  assert.equal(out.flags.serial.label, 'Pouze USB');
}

// translate locale resolution
{
  const config = { baseLocale: 'en', locales: ['en', 'cs', 'pt'] };
  assert.deepEqual(resolveTargetLocales(undefined, config), ['cs', 'pt']);
  assert.deepEqual(resolveTargetLocales('cs', config), ['cs']);
  assert.throws(() => resolveTargetLocales('en', config), /base locale/);
  assert.throws(() => resolveTargetLocales('de', config), /unknown locale/);
}

console.log('✓ catalog-i18n tests passed');
