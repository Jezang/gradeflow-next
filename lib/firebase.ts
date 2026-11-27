import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

export function studentAuth() { const name = 'gradeflow-student'; const existing = getApps().find(app => app.name === name); return existing ? getAuth(existing) : initializeAuth(initializeApp(firebaseConfig, name), { persistence: inMemoryPersistence }); }
