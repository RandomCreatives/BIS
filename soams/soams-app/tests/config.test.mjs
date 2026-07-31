import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isValidISODate,
  isWeekend,
  shiftISODate,
} from '../src/lib/config.ts';

test('isValidISODate accepts real calendar dates', () => {
  assert.equal(isValidISODate('2024-02-29'), true);
  assert.equal(isValidISODate('2026-07-31'), true);
});

test('isValidISODate rejects normalized and malformed dates', () => {
  assert.equal(isValidISODate('2023-02-29'), false);
  assert.equal(isValidISODate('2026-02-31'), false);
  assert.equal(isValidISODate('2026-13-01'), false);
  assert.equal(isValidISODate('2026-00-10'), false);
  assert.equal(isValidISODate('31-07-2026'), false);
  assert.equal(isValidISODate('2026-7-1'), false);
});

test('shiftISODate uses stable UTC calendar arithmetic', () => {
  assert.equal(shiftISODate('2024-02-28', 1), '2024-02-29');
  assert.equal(shiftISODate('2024-12-31', 1), '2025-01-01');
  assert.equal(shiftISODate('2025-01-01', -1), '2024-12-31');
});

test('isWeekend identifies Saturday and Sunday', () => {
  assert.equal(isWeekend('2026-08-01'), true);
  assert.equal(isWeekend('2026-08-02'), true);
  assert.equal(isWeekend('2026-08-03'), false);
});
