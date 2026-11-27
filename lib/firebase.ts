import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config';

export function firebaseServices() {
  const app = getApps().some((candidate) => candidate.name === '[DEFAULT]')
    ? getApp()
    : initializeApp(firebaseConfig);
  return { auth: getAuth(app), db: getFirestore(app) };
}

export function portalAuth() {
  const name = 'gradeflow-portal';
  const existing = getApps().find((app) => app.name === name);
  return existing
    ? getAuth(existing)
    : initializeAuth(initializeApp(firebaseConfig, name), { persistence: inMemoryPersistence });
}

export function studentAuth() {
  const name = 'gradeflow-student';
  const existing = getApps().find(app => app.name === name);
  if (existing) return getAuth(existing);
  const useEmulators = process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_STUDENT_PORTAL_DEMO_EMULATORS === 'true';
  const config = useEmulators ? {projectId: 'demo-gradeflow', apiKey: 'demo-gradeflow'} : firebaseConfig;
  const app = initializeApp(config, name);
  const auth = initializeAuth(app, {persistence: inMemoryPersistence});
  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
  }
  return auth;
}
