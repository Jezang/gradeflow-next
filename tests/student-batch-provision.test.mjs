import assert from 'node:assert/strict';
import test from 'node:test';
import {parseStudentBatch, provisionStudentBatch} from '../lib/student-batch-provision.ts';

test('batch input rejects duplicate, invalid and oversized lists', () => {
  assert.deepEqual(parseStudentBatch(['s1', 's2']), ['s1', 's2']);
  for (const invalid of [null, [], ['s1', 's1'], ['s1/s2'], Array.from({length: 11}, (_, i) => 's' + i)]) {
    assert.equal(parseStudentBatch(invalid), null);
  }
});

test('preflight rejects conflicting login aliases before starting any account write', async () => {
  const backend = {
    readStudentNumber: async () => '00123',
    enabled: async () => assert.fail('Account issuance must not begin before preflight succeeds'),
  };
  await assert.rejects(provisionStudentBatch(backend, 'test-token', ['s1', 's2']), /Duplicate login alias/);
});

test('bulk provisioning reports conflicts without discarding successful issued credentials', async () => {
  const backend = {
    enabled: async () => true,
    authorizeAdmin: async () => 'demo-admin',
    withOperation: async (_id, run) => run(),
    readStudentNumber: async id => id === 's1' ? '00123' : '00456',
    readOwnerUid: async id => id === 's1' ? 'existing-user' : null,
    ensureDedicatedAccount: async () => {},
    installCredential: async () => {},
    enableAccount: async () => {},
  };
  const results = await provisionStudentBatch(backend, 'test-token', ['s1', 's2']);
  assert.deepEqual(results[0], {studentId: 's1', status: 'unavailable'});
  assert.equal(results[1].studentId, 's2');
  assert.equal(results[1].status, 'issued');
  assert.match(results[1].uid, /^student-[a-f0-9]{64}$/);
  assert.match(results[1].password, /^[A-Za-z0-9_-]{32}$/);
});
