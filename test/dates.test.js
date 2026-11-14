import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDay, addDays } from '../js/dates.js';

test("localDay gives the phone's own calendar date", () => {
  assert.equal(localDay(new Date(2026, 10, 14, 23, 59)), '2026-11-14');
  assert.equal(localDay(new Date(2026, 10, 15, 0, 1)), '2026-11-15');
  assert.equal(localDay(new Date(2027, 0, 5, 12, 0)), '2027-01-05');
});

test('addDays crosses months, years and clock changes', () => {
  assert.equal(addDays('2026-11-14', 0), '2026-11-14');
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-03-27', 2), '2027-03-29'); // UK clocks change on 28 March 2027
});
