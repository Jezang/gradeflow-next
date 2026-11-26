import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readPortal } from '../lib/portal-access.ts';
import { firebasePortalSources } from '../lib/portal-firebase.ts';
import { portalEnabled } from '../lib/portal-release-policy.ts';

const sample = {
  studentId: 'synthetic-001',
  studentName: 'นักเรียนจำลอง A',
  roomId: 'room-1',
  courseId: 'course-1',
  course: 'วิชาจำลอง',
  assessment: 'งานจำลอง',
  score: 0,
  maxScore: 10,
  published: true,
};

function request(kind, token = 'synthetic-token', method = 'GET') {
  return new Request(`https://example.test/api/portal/${kind}?studentId=synthetic-002&roomId=room-2&uid=other`, {
    method,
    headers: token ? { Authorization: 'Bearer ' + token } : {},
  });
}

function sources(projection, trace = []) {
  return {
    async verifyIdentity(token) {
      trace.push(['verify', token]);
      return token === 'synthetic-token' ? 'uid-1' : null;
    },
    async readProjection(uid, token) {
      trace.push(['read', uid, token]);
      return projection;
    },
  };
}

test('both release gates deny access without contacting authentication or data providers', async () => {
  for (const kind of ['advisor', 'student']) {
    const trace = [];
    assert.equal(portalEnabled(kind), false);
    const result = await readPortal(request(kind), kind, portalEnabled(kind), sources({}, trace));
    assert.equal(result.status, 503);
    assert.match(result.headers.get('cache-control'), /no-store/);
    assert.deepEqual(trace, []);
  }
});

test('missing and malformed tokens are denied before lookup, and rejected tokens never read results', async () => {
  const trace = [];
  for (const token of ['', 'two tokens', 'x'.repeat(8192)]) {
    const result = await readPortal(request('student', token), 'student', true, sources({}, trace));
    assert.equal(result.status, 401);
  }
  assert.deepEqual(trace, []);

  const invalid = await readPortal(request('student', 'rejected-token'), 'student', true, sources({}, trace));
  assert.equal(invalid.status, 401);
  assert.deepEqual(trace, [['verify', 'rejected-token']]);
});

test('roles, suspension, missing assignments and mismatched identity fail closed', async () => {
  for (const projection of [
    null,
    { uid: 'uid-1', role: 'advisor', active: false, scopes: [{ roomId: 'room-1', courseId: 'course-1' }] },
    { uid: 'uid-1', role: 'student', active: true, studentId: 'synthetic-001' },
    { uid: 'uid-1', role: 'teacher', active: true, scopes: [{ roomId: 'room-1', courseId: 'course-1' }] },
    { uid: 'other', role: 'advisor', active: true, scopes: [{ roomId: 'room-1', courseId: 'course-1' }] },
    { uid: 'uid-1', role: 'advisor', active: true, scopes: [] },
  ]) {
    const result = await readPortal(request('advisor'), 'advisor', true, sources(projection));
    assert.equal(result.status, 403);
  }
  const noStudentId = await readPortal(request('student'), 'student', true, sources({
    uid: 'uid-1', role: 'student', active: true,
  }));
  assert.equal(noStudentId.status, 403);
});

test('student sees only own published rows and cannot select a different identity through the URL', async () => {
  const trace = [];
  const result = await readPortal(request('student'), 'student', true, sources({
    uid: 'uid-1',
    role: 'student',
    active: true,
    studentId: 'synthetic-001',
    results: [
      { ...sample, updatedBy: 'private-staff-id' },
      { ...sample, assessment: 'งานที่ยังไม่ให้คะแนน', score: null },
      { ...sample, studentId: 'synthetic-002' },
      { ...sample, published: false },
      { ...sample, score: 11 },
      null,
    ],
  }, trace));

  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(trace, [['verify', 'synthetic-token'], ['read', 'uid-1', 'synthetic-token']]);
  assert.deepEqual(await result.json(), {
    results: [
      { course: 'วิชาจำลอง', assessment: 'งานจำลอง', score: 0, maxScore: 10 },
      { course: 'วิชาจำลอง', assessment: 'งานที่ยังไม่ให้คะแนน', score: null, maxScore: 10 },
    ],
  });
});

test('advisor must match an assigned room and course as a pair, and receives read-only results', async () => {
  const projection = {
    uid: 'uid-1',
    role: 'advisor',
    active: true,
    scopes: [{ roomId: 'room-1', courseId: 'course-1' }, { roomId: 'room-2', courseId: 'course-2' }],
    results: [
      { ...sample, auditId: 'private-audit' },
      { ...sample, roomId: 'room-2' },
      { ...sample, courseId: 'course-2' },
      { ...sample, published: false },
    ],
  };
  const result = await readPortal(request('advisor'), 'advisor', true, sources(projection));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), {
    results: [{
      studentId: 'synthetic-001',
      studentName: 'นักเรียนจำลอง A',
      course: 'วิชาจำลอง',
      assessment: 'งานจำลอง',
      score: 0,
      maxScore: 10,
    }],
  });

  for (const method of ['POST', 'PATCH', 'DELETE']) {
    const trace = [];
    const mutation = await readPortal(request('advisor', 'synthetic-token', method), 'advisor', true, sources(projection, trace));
    assert.equal(mutation.status, 405);
    assert.deepEqual(trace, []);
  }
});

function firebaseToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    aud: 'demo-portals',
    iss: 'https://securetoken.google.com/demo-portals',
    sub: 'uid-verified',
    auth_time: now - 60,
    exp: now + 3600,
    ...overrides,
  })).toString('base64url');
  return 'mock-header.' + payload + '.mock-signature';
}

test('backend authenticates using only injected requests and reads only the verified UID document', async () => {
  const calls = [];
  const token = firebaseToken();
  const fakeFetch = async (url, options) => {
    calls.push([url, options]);
    if (calls.length === 1) {
      return Response.json({ users: [{ localId: 'uid-verified', emailVerified: true, validSince: '1' }] });
    }
    return Response.json({
      fields: {
        uid: { stringValue: 'uid-verified' },
        role: { stringValue: 'student' },
        active: { booleanValue: true },
        studentId: { stringValue: 'synthetic-001' },
      },
    });
  };
  const backend = firebasePortalSources({ apiKey: 'synthetic-key', projectId: 'demo-portals' }, fakeFetch);
  const result = await readPortal(request('student', token), 'student', true, backend);
  assert.equal(result.status, 200);
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[0][1].body), { idToken: token });
  assert.match(calls[1][0], /demo-portals\/databases\/\(default\)\/documents\/portalViews\/uid-verified$/);
  assert.deepEqual(calls[1][1].headers, { Authorization: 'Bearer ' + token });
  assert.ok(calls.every(([, options]) => options.cache === 'no-store'));
});

test('identity adapter denies disabled and unverified accounts and keeps service errors generic', async () => {
  const config = { apiKey: 'synthetic-key', projectId: 'demo-portals' };
  const token = firebaseToken({ auth_time: 1000 });
  for (const account of [
    { localId: 'uid-verified', emailVerified: true, validSince: '1', disabled: true },
    { localId: 'uid-verified', emailVerified: false, validSince: '1' },
    { localId: 'uid-verified/extra-path', emailVerified: true, validSince: '1' },
    { localId: 'different-uid', emailVerified: true, validSince: '1' },
    { localId: 'uid-verified', emailVerified: true, validSince: '1001' },
    { localId: 'uid-verified', emailVerified: true },
  ]) {
    const backend = firebasePortalSources(config, async () => Response.json({ users: [account] }));
    assert.equal((await readPortal(request('student', token), 'student', true, backend)).status, 401);
  }
  const backend = firebasePortalSources(config, async () => new Response('sensitive upstream details', { status: 500 }));
  const result = await readPortal(request('student', token), 'student', true, backend);
  assert.equal(result.status, 503);
  assert.doesNotMatch(await result.text(), /sensitive upstream details/);
});

test('wrong Firebase projects, wrong issuers and expired tokens never reach the verifier', async () => {
  const config = { apiKey: 'synthetic-key', projectId: 'demo-portals' };
  let calls = 0;
  const backend = firebasePortalSources(config, async () => {
    calls++;
    return new Response(null, { status: 500 });
  });
  for (const override of [{ aud: 'incorrect-project' }, { iss: 'https://example.test' }, { exp: 1 }]) {
    assert.equal((await readPortal(request('student', firebaseToken(override)), 'student', true, backend)).status, 401);
  }
  assert.equal(calls, 0);
});
