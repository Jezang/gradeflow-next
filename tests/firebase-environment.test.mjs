import assert from 'node:assert/strict';
import test from 'node:test';
import {firebaseConfig} from '../lib/firebase-config.ts';
import {readStagingServiceAccount, selectFirebaseWebConfig, validateStudentFirebaseTarget} from '../lib/firebase-environment.ts';

const projectId = 'gradeflow-staging-test';
const preview = {
  projectId,
  apiKey: 'AIza' + 'a'.repeat(35),
  authDomain: projectId + '.firebaseapp.com',
  appId: '1:1234567:web:abcdef',
};

test('preview requires an isolated web configuration and never falls back to production', () => {
  assert.deepEqual(selectFirebaseWebConfig('preview', preview), preview);
  for (const overrides of [
    {projectId: undefined}, {projectId: firebaseConfig.projectId}, {authDomain: firebaseConfig.authDomain},
    {apiKey: firebaseConfig.apiKey}, {appId: firebaseConfig.appId}, {projectId: 'demo-gradeflow'},
  ]) assert.throws(() => selectFirebaseWebConfig('preview', {...preview, ...overrides}));
  assert.throws(() => selectFirebaseWebConfig(undefined, {}));
  assert.deepEqual(selectFirebaseWebConfig('production', preview), firebaseConfig);
});

test('server refuses project mismatches, Production mode and preview emulator variables', () => {
  assert.equal(validateStudentFirebaseTarget('preview', projectId, projectId), projectId);
  assert.throws(() => validateStudentFirebaseTarget('preview', projectId, firebaseConfig.projectId));
  assert.throws(() => validateStudentFirebaseTarget('preview', firebaseConfig.projectId, firebaseConfig.projectId));
  assert.throws(() => validateStudentFirebaseTarget('production', projectId, projectId));
  assert.throws(() => validateStudentFirebaseTarget('preview', projectId, projectId, '127.0.0.1:9099'));
});

test('emulator accepts only the demo project and loopback addresses', () => {
  const web = selectFirebaseWebConfig('emulator', preview);
  assert.equal(web.projectId, 'demo-gradeflow');
  assert.equal(validateStudentFirebaseTarget('emulator', web.projectId, web.projectId, '127.0.0.1:9099', '127.0.0.1:8187'), web.projectId);
  assert.throws(() => validateStudentFirebaseTarget('emulator', web.projectId, web.projectId, 'example.invalid:9099', '127.0.0.1:8187'));
  assert.throws(() => validateStudentFirebaseTarget('emulator', projectId, projectId, '127.0.0.1:9099', '127.0.0.1:8187'));
});

test('staging service-account project and email domain must match', () => {
  const testAccount = {
    type: 'service_account', project_id: projectId,
    client_email: 'synthetic@' + projectId + '.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nTEST-PLACEHOLDER',
  };
  assert.equal(readStagingServiceAccount(JSON.stringify(testAccount), projectId).projectId, projectId);
  assert.throws(() => readStagingServiceAccount(JSON.stringify({...testAccount, project_id: firebaseConfig.projectId}), projectId));
  assert.throws(() => readStagingServiceAccount(JSON.stringify({...testAccount, client_email: 'synthetic@example.invalid'}), projectId));
  assert.throws(() => readStagingServiceAccount(undefined, projectId));
});

test('Next build ignores supplied mode and keeps production portal switches closed', async () => {
  const keys = [
    'VERCEL', 'VERCEL_ENV', 'NEXT_PUBLIC_GRADEFLOW_FIREBASE_MODE',
    'NEXT_PUBLIC_STUDENT_PORTAL_ENABLED', 'NEXT_PUBLIC_STUDENT_PORTAL_ADMIN_ENABLED',
  ];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.NEXT_PUBLIC_GRADEFLOW_FIREBASE_MODE = 'preview';
    process.env.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED = 'true';
    process.env.NEXT_PUBLIC_STUDENT_PORTAL_ADMIN_ENABLED = 'true';
    delete process.env.VERCEL;
    const local = (await import('../next.config.mjs?local')).default.env;
    assert.equal(local.NEXT_PUBLIC_GRADEFLOW_FIREBASE_MODE, 'disabled');
    assert.equal(local.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED, 'false');

    process.env.VERCEL = '1';
    process.env.VERCEL_ENV = 'production';
    const production = (await import('../next.config.mjs?production')).default.env;
    assert.equal(production.NEXT_PUBLIC_GRADEFLOW_FIREBASE_MODE, 'production');
    assert.equal(production.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED, 'false');
    assert.equal(production.NEXT_PUBLIC_STUDENT_PORTAL_ADMIN_ENABLED, 'false');

    process.env.VERCEL_ENV = 'preview';
    const staging = (await import('../next.config.mjs?preview')).default.env;
    assert.equal(staging.NEXT_PUBLIC_GRADEFLOW_FIREBASE_MODE, 'preview');
    assert.equal(staging.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED, 'true');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
