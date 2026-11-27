import assert from 'node:assert/strict';
import test from 'node:test';
import {parseStudentMembershipWindows} from '../lib/student-membership-windows.ts';

test('explicit empty, adjacent and open course memberships are representable', () => {
  assert.deepEqual(parseStudentMembershipWindows([]), []);
  const windows = [{from: 0, until: 10}, {from: 10, until: 20}, {from: 30, until: null}];
  assert.deepEqual(parseStudentMembershipWindows(windows), windows);
});

test('untrusted or conflicting membership windows fail closed', () => {
  for (const windows of [
    null, [{}], [{from: -1, until: 1}], [{from: 0, until: 0}],
    [{from: 0, until: 10}, {from: 9, until: 20}],
    [{from: 0, until: null}, {from: 20, until: 30}],
    [{from: 10, until: 20}, {from: 0, until: 9}],
    [{from: 0, until: null, roomId: 'x'}],
  ]) assert.throws(() => parseStudentMembershipWindows(windows));
});
