import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const globeSource = readFileSync(
  new URL('../src/components/globe/TethysGlobe.tsx', import.meta.url),
  'utf8',
);

test('replays current filtered events when MapLibre layers become ready', () => {
  assert.match(globeSource, /const \[layersReady, setLayersReady\] = useState\(false\)/);

  const sourceCreatedAt = globeSource.indexOf("map.addSource('events'");
  const readyAt = globeSource.indexOf('setLayersReady(true)');
  assert.ok(sourceCreatedAt >= 0, 'events source must be created');
  assert.ok(readyAt > sourceCreatedAt, 'layers become ready only after the events source exists');

  const hydrationEffectAt = globeSource.indexOf('if (!layersReady) return;');
  const setDataAt = globeSource.indexOf('src.setData(toGeoJSON(', hydrationEffectAt);
  const dependenciesAt = globeSource.indexOf(
    '}, [layersReady, events, activeCategories, minMagnitude, maxMagnitude]);',
    setDataAt,
  );

  assert.ok(hydrationEffectAt >= 0, 'hydration waits for layer readiness');
  assert.ok(setDataAt > hydrationEffectAt, 'ready source receives the current filtered events');
  assert.ok(dependenciesAt > setDataAt, 'layer readiness and all filter inputs replay hydration');
});
