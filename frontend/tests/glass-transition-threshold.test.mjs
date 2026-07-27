import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/utils/glass.ts', import.meta.url),
  'utf8',
);

function readThreshold(name) {
  const match = source.match(new RegExp(`const ${name} = ([0-9.]+);`));
  assert.ok(match, `${name} must be declared explicitly`);
  return Number(match[1]);
}

function altitudeAtZoom(zoom) {
  return (2 ** (15 - zoom) * 100) / 6_371_000;
}

test('initial globe view uses white glass and close terrain uses black glass', () => {
  const terrainAltitude = readThreshold('TERRAIN_ALTITUDE');
  const spaceAltitude = readThreshold('SPACE_ALTITUDE');
  const mix = (altitude) => Math.max(
    0,
    Math.min(1, (altitude - terrainAltitude) / (spaceAltitude - terrainAltitude)),
  );

  assert.ok(
    mix(altitudeAtZoom(2.5)) >= 0.95,
    'initial zoom 2.5 should use white glass over dark space',
  );
  assert.ok(
    mix(altitudeAtZoom(3.5)) >= 0.70,
    'zoom 3.5 should remain predominantly white until closer to Earth',
  );
  assert.ok(
    mix(altitudeAtZoom(5)) <= 0.05,
    'close zoom 5 should use black glass over bright terrain',
  );
  assert.ok(spaceAltitude > terrainAltitude, 'transition range must be ordered');
});
