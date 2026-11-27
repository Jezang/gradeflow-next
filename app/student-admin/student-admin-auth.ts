import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { firebaseServices } from '../../lib/firebase';

export const studentAdminDemo =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_STUDENT_PORTAL_DEMO_EMULATORS === 'true';

export function studentAdminAuth() {
  if (!studentAdminDemo) return firebaseServices().auth;

  const name = 'gradeflow-student-admin-demo';
  const existing = getApps().find(app => app.name === name);
  if (existing) return getAuth(existing);
  const app = initializeApp({ projectId: 'demo-gradeflow', apiKey: 'demo-gradeflow' }, name);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  return auth;
}
