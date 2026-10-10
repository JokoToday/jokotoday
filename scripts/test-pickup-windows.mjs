import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/lib/pickupWindows.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { generatePickupWindows, pickupWindowLabel } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const hours = (o, c, m) => ({ pickup_open_time: o, pickup_close_time: c, pickup_slot_minutes: m });
for (const [interval, count] of [[15, 16], [30, 8], [60, 4]]) {
  const slots = generatePickupWindows(hours('09:00:00', '13:00:00', interval));
  assert.equal(slots.length, count);
  assert.equal(slots.at(-1).end, '13:00');
  assert.equal(slots[0].start, '09:00');
}
assert.deepEqual(generatePickupWindows(hours('09:10', '10:10', 30)), [{ start: '09:10', end: '09:40' }, { start: '09:40', end: '10:10' }]);
for (const invalid of [hours('09:00', '13:10', 30), hours('13:00', '09:00', 30), hours('09:00', '09:00', 30), hours('09:00:01', '13:00', 30), hours('09:00', '24:00', 30), hours('09:00', '13:00', 20), hours(null, '13:00', 30)]) {
  assert.deepEqual(generatePickupWindows(invalid), []);
}
assert.equal(pickupWindowLabel('10:30:00', '11:00:00'), '10:30–11:00');
assert.equal(pickupWindowLabel(null, null), '');
console.log('PASS: pickup-window generation, boundary and historical-null tests');
