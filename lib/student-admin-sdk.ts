import {readFileSync} from 'node:fs';
import {cert, getApps, initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {readStagingServiceAccount, validateStudentFirebaseTarget} from './firebase-environment';
import {firebaseMode, firebaseWebConfig} from './firebase-target';

export function studentServerEnabled() {
  return process.env.STUDENT_PORTAL_SERVER_ENABLED === 'true' && (
    (firebaseMode === 'preview' && process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'preview') ||
    (firebaseMode === 'emulator' && process.env.NODE_ENV === 'development' && process.env.VERCEL !== '1')
  );
}

export function studentAdminServices() {
  if (!studentServerEnabled()) throw Error('Student server disabled');

  const projectId = validateStudentFirebaseTarget(
    firebaseMode, firebaseWebConfig().projectId, process.env.STUDENT_PORTAL_PROJECT_ID,
    process.env.FIREBASE_AUTH_EMULATOR_HOST, process.env.FIRESTORE_EMULATOR_HOST,
  );
  const account = firebaseMode === 'preview'
    ? process.env.STAGING_FIREBASE_ADMIN_CREDENTIALS_JSON
    : process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
      : undefined;
  const credential = cert(readStagingServiceAccount(account, projectId));
  const name = 'gradeflow-student-server';
  const app = getApps().find(candidate => candidate.name === name) ?? initializeApp({credential, projectId}, name);
  if (app.options.projectId !== projectId) throw Error('Student Firebase project mismatch');
  return {auth: getAuth(app), db: getFirestore(app)};
}
