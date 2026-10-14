import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWorkingLeaveDays, localDateKey, minutesBetween, parseIsoDate } from '../src/lib/workforce/calculations.ts';

test('attendance duration supports overnight sessions', () => assert.equal(minutesBetween(new Date('2026-10-06T18:30:00Z'), new Date('2026-10-07T02:30:00Z')), 480));
test('negative attendance duration is rejected', () => assert.throws(() => minutesBetween(new Date('2026-10-07T02:30:00Z'), new Date('2026-10-06T18:30:00Z'))));
test('company timezone determines the work date', () => assert.equal(localDateKey(new Date('2026-10-06T20:00:00Z'), 'Asia/Kolkata'), '2026-10-07'));
test('leave excludes weekly offs and configured holidays', () => assert.equal(calculateWorkingLeaveDays('2026-10-05', '2026-10-11', [1, 2, 3, 4, 5], ['2026-10-07'], 'FULL_DAY'), 4));
test('single working-day half leave is deterministic', () => assert.equal(calculateWorkingLeaveDays('2026-10-06', '2026-10-06', [1, 2, 3, 4, 5], [], 'FIRST_HALF'), 0.5));
test('multi-day half leave and malformed dates are rejected', () => {
  assert.throws(() => calculateWorkingLeaveDays('2026-10-06', '2026-10-07', [1, 2, 3, 4, 5], [], 'FIRST_HALF'));
  assert.equal(parseIsoDate('2026-02-30'), null);
});
